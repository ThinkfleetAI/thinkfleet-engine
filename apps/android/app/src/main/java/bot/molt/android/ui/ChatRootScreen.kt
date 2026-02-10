package bot.molt.android.ui

import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import bot.molt.android.agents.AgentListScreen
import bot.molt.android.crews.CrewChatScreen
import bot.molt.android.model.AppState
import bot.molt.android.networking.*
import bot.molt.android.voice.SpeechToTextHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

@Composable
fun ChatRootScreen(appState: AppState) {
    val agents by appState.agents.collectAsState()
    val crews by appState.crews.collectAsState()
    var selectedMode by remember { mutableStateOf(0) } // 0 = Agents, 1 = Crews
    var selectedAgent by remember { mutableStateOf<Agent?>(null) }
    var selectedCrew by remember { mutableStateOf<Crew?>(null) }

    if (selectedAgent != null) {
        AgentChatFullScreen(appState, selectedAgent!!) { selectedAgent = null }
        return
    }

    if (selectedCrew != null) {
        CrewChatScreen(appState, selectedCrew!!) { selectedCrew = null }
        return
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Chat") }) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Agents / Crews toggle
            PrimaryTabRow(selectedTabIndex = selectedMode) {
                Tab(selected = selectedMode == 0, onClick = { selectedMode = 0 }) {
                    Text("Agents", modifier = Modifier.padding(vertical = 12.dp))
                }
                Tab(selected = selectedMode == 1, onClick = { selectedMode = 1 }) {
                    Text("Crews", modifier = Modifier.padding(vertical = 12.dp))
                }
            }

            if (selectedMode == 0) {
                // Agent list for chat
                if (agents.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.ChatBubble,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text("No agents available", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    agents.forEach { agent ->
                        ListItem(
                            headlineContent = { Text(agent.name) },
                            supportingContent = {
                                Text(
                                    agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                                    color = agentStatusColor(agent.status),
                                )
                            },
                            leadingContent = {
                                Surface(
                                    color = agentStatusColor(agent.status),
                                    shape = MaterialTheme.shapes.small,
                                    modifier = Modifier.size(10.dp),
                                ) {}
                            },
                            trailingContent = {
                                Icon(Icons.Default.ChevronRight, contentDescription = null)
                            },
                            modifier = Modifier.clickable { selectedAgent = agent },
                        )
                        HorizontalDivider()
                    }
                }
            } else {
                // Crew list for chat
                if (crews.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.Groups,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text("No crews available", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    crews.forEach { crew ->
                        ListItem(
                            headlineContent = { Text(crew.name) },
                            supportingContent = {
                                val memberCount = crew.members?.size ?: 0
                                Text("$memberCount members · ${crew.status.name}")
                            },
                            leadingContent = {
                                Icon(Icons.Default.Groups, contentDescription = null)
                            },
                            trailingContent = {
                                Icon(Icons.Default.ChevronRight, contentDescription = null)
                            },
                            modifier = Modifier.clickable { selectedCrew = crew },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

data class PendingChatAttachment(
    val id: String,
    val fileName: String,
    val mimeType: String,
    val base64: String,
)

@Composable
fun AgentChatFullScreen(appState: AppState, agent: Agent, onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(agent.name)
                        Text(
                            agent.status.name.lowercase().replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.bodySmall,
                            color = agentStatusColor(agent.status),
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
            )
        }
    ) { padding ->
        AgentChatContent(appState, agent, Modifier.padding(padding))
    }
}

/**
 * Core agent chat UI with messages, attachments, voice-to-text.
 * Used by both AgentChatFullScreen and AgentDetailScreen's Chat tab.
 */
@Composable
fun AgentChatContent(appState: AppState, agent: Agent, modifier: Modifier = Modifier) {
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var isStreaming by remember { mutableStateOf(false) }
    var streamingMessageId by remember { mutableStateOf<String?>(null) }
    var pendingAttachments by remember { mutableStateOf<List<PendingChatAttachment>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val resolver = context.contentResolver
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current

    // Voice-to-text
    val speechHelper = remember { SpeechToTextHelper(context) }
    val speechListening by speechHelper.isListening.collectAsState()
    val speechTranscript by speechHelper.transcript.collectAsState()

    val canSend = inputText.isNotBlank() || pendingAttachments.isNotEmpty()

    // Update input text from speech transcript
    LaunchedEffect(speechTranscript) {
        if (speechTranscript.isNotEmpty()) {
            inputText = speechTranscript
        }
    }

    // Clean up speech recognizer
    DisposableEffect(Unit) {
        onDispose { speechHelper.destroy() }
    }

    // Photo picker launcher
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 4),
    ) { uris: List<Uri> ->
        scope.launch {
            for (uri in uris) {
                if (pendingAttachments.size >= 4) break
                val att = loadAttachmentFromUri(resolver, uri) ?: continue
                pendingAttachments = pendingAttachments + att
            }
        }
    }

    // Document picker launcher
    val docPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val att = loadAttachmentFromUri(resolver, uri) ?: return@launch
            if (pendingAttachments.size < 4) {
                pendingAttachments = pendingAttachments + att
            }
        }
    }

    // Load history and subscribe to chat events
    LaunchedEffect(agent.id) {
        isLoading = true
        try {
            val orgId = appState.currentOrganization.value?.id ?: return@LaunchedEffect
            val response = appState.apiClient.rpc(
                "assistants.chat.history",
                ChatHistoryInput(agent.id, orgId, limit = 50),
                ChatHistoryInput.serializer(),
                ChatHistoryResponse.serializer()
            )
            messages = response.messages
        } catch (_: Exception) { }
        isLoading = false

        // Subscribe to typed chat events
        appState.socketManager.subscribeToChatEvents(agent.id) { event ->
            val text = event.text
            val role = event.role ?: "assistant"

            when (event.state) {
                "delta" -> {
                    if (!text.isNullOrEmpty()) {
                        isStreaming = true
                        val sid = streamingMessageId
                        if (sid != null) {
                            // Append to existing streaming message
                            messages = messages.map { msg ->
                                if (msg.id == sid) msg.copy(content = msg.content + text) else msg
                            }
                        } else {
                            // Create new streaming message
                            val newId = java.util.UUID.randomUUID().toString()
                            streamingMessageId = newId
                            messages = messages + ChatMessage(
                                id = newId, content = text, role = role,
                                agentId = agent.id, createdAt = ""
                            )
                        }
                    }
                }
                "final" -> {
                    isStreaming = false
                    val sid = streamingMessageId
                    if (sid != null) {
                        // Finalize streaming message (content already accumulated)
                        streamingMessageId = null
                    } else if (!text.isNullOrEmpty()) {
                        // No deltas received, create final message
                        messages = messages + ChatMessage(
                            id = java.util.UUID.randomUUID().toString(),
                            content = text, role = role,
                            agentId = agent.id, createdAt = ""
                        )
                    }
                    streamingMessageId = null
                }
                "error" -> {
                    isStreaming = false
                    streamingMessageId = null
                    messages = messages + ChatMessage(
                        id = java.util.UUID.randomUUID().toString(),
                        content = "Error: ${text ?: "Unknown error"}",
                        role = "system", agentId = agent.id, createdAt = ""
                    )
                }
            }
        }
    }

    DisposableEffect(agent.id) {
        onDispose { appState.socketManager.unsubscribeFromAgent(agent.id) }
    }

    Column(modifier.fillMaxSize()) {
            if (isLoading) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (messages.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.ChatBubble,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Send a message to start chatting", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                androidx.compose.foundation.lazy.LazyColumn(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                    reverseLayout = true,
                ) {
                    val reversed = messages.reversed()
                    items(reversed.size, key = { reversed[it].id }) { idx ->
                        val msg = reversed[idx]
                        val isUser = msg.role == "user"
                        val isSystem = msg.role == "system"
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
                        ) {
                            Surface(
                                color = when {
                                    isSystem -> MaterialTheme.colorScheme.errorContainer
                                    isUser -> MaterialTheme.colorScheme.primaryContainer
                                    else -> MaterialTheme.colorScheme.surfaceVariant
                                },
                                shape = MaterialTheme.shapes.medium,
                            ) {
                                Row(
                                    Modifier.padding(12.dp).widthIn(max = 280.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        msg.content,
                                        modifier = Modifier.weight(1f, fill = false),
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                    if (msg.id == streamingMessageId) {
                                        Spacer(Modifier.width(8.dp))
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(12.dp),
                                            strokeWidth = 2.dp,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            HorizontalDivider()

            // Typing indicator
            if (isStreaming) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TypingDotsIndicator()
                    Text(
                        "AI is responding...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Attachment preview strip
            if (pendingAttachments.isNotEmpty()) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    pendingAttachments.forEach { att ->
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                        ) {
                            Row(
                                Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Icon(
                                    if (att.mimeType.startsWith("image/")) Icons.Default.Image else Icons.AutoMirrored.Filled.InsertDriveFile,
                                    contentDescription = null, modifier = Modifier.size(16.dp),
                                )
                                Text(att.fileName, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                                IconButton(onClick = {
                                    pendingAttachments = pendingAttachments.filter { it.id != att.id }
                                }, modifier = Modifier.size(20.dp)) {
                                    Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }
            }

            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                // Photo picker button
                IconButton(onClick = {
                    photoPickerLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }) {
                    Icon(Icons.Default.Image, contentDescription = "Add photo")
                }
                // Document picker button
                IconButton(onClick = {
                    docPickerLauncher.launch(arrayOf("*/*"))
                }) {
                    Icon(Icons.Default.AttachFile, contentDescription = "Add file")
                }

                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message ${agent.name}...") },
                    singleLine = true,
                )

                // Mic button for voice-to-text
                IconButton(onClick = {
                    if (speechListening) speechHelper.stopListening() else speechHelper.startListening()
                }) {
                    Icon(
                        if (speechListening) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = if (speechListening) "Stop listening" else "Voice input",
                        tint = if (speechListening) Color(0xFFF44336) else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(Modifier.width(4.dp))
                Button(
                    onClick = {
                        val text = inputText.trim()
                        val atts = pendingAttachments.toList()
                        if (text.isNotEmpty() || atts.isNotEmpty()) {
                            focusManager.clearFocus()
                            inputText = ""
                            pendingAttachments = emptyList()
                            speechHelper.stopListening()

                                val displayText = if (text.isEmpty()) "[Sent ${atts.size} file${if (atts.size == 1) "" else "s"}]" else text

                                // Optimistic local message
                                messages = messages + ChatMessage(
                                    id = java.util.UUID.randomUUID().toString(),
                                    content = displayText, role = "user",
                                    agentId = agent.id, createdAt = ""
                                )
                                isStreaming = true
                                // Send via Socket.IO RPC with attachments
                                scope.launch {
                                    try {
                                        val params = mutableMapOf<String, Any>(
                                            "message" to (if (text.isEmpty()) "[Uploaded ${atts.size} file(s)]" else text),
                                            "sessionKey" to "mobile:${agent.id}",
                                            "idempotencyKey" to java.util.UUID.randomUUID().toString(),
                                        )
                                        if (atts.isNotEmpty()) {
                                            params["attachments"] = atts.map { att ->
                                                mapOf(
                                                    "mimeType" to att.mimeType,
                                                    "content" to att.base64,
                                                    "fileName" to att.fileName,
                                                )
                                            }
                                        }
                                        appState.socketManager.sendRPC(
                                            agentId = agent.id,
                                            method = "chat.send",
                                            params = params,
                                        )
                                    } catch (e: Exception) {
                                        isStreaming = false
                                        messages = messages + ChatMessage(
                                            id = java.util.UUID.randomUUID().toString(),
                                            content = "Failed to send: ${e.message}",
                                            role = "system", agentId = agent.id, createdAt = ""
                                        )
                                    }
                                }
                            }
                        },
                        enabled = canSend,
                    ) { Text("Send") }
            }
        }
    }

@Suppress("unused")
@Composable
private fun ChatBubbleInline(msg: ChatMessage, isStreaming: Boolean) {
    val isUser = msg.role == "user"
    val isSystem = msg.role == "system"
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = when {
                isSystem -> MaterialTheme.colorScheme.errorContainer
                isUser -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
            shape = MaterialTheme.shapes.medium,
        ) {
            Row(
                Modifier.padding(12.dp).widthIn(max = 280.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    msg.content,
                    modifier = Modifier.weight(1f, fill = false),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isStreaming) {
                    Spacer(Modifier.width(8.dp))
                    CircularProgressIndicator(
                        modifier = Modifier.size(12.dp),
                        strokeWidth = 2.dp,
                    )
                }
            }
        }
    }
}

@Composable
private fun TypingDotsIndicator() {
    var dotIndex by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(300)
            dotIndex = (dotIndex + 1) % 3
        }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { index ->
            val alpha = if (index == dotIndex) 1f else 0.3f
            Box(
                Modifier.size(6.dp).background(
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
                    shape = RoundedCornerShape(50),
                )
            )
        }
    }
}

private suspend fun loadAttachmentFromUri(
    resolver: android.content.ContentResolver,
    uri: Uri,
): PendingChatAttachment? {
    return withContext(Dispatchers.IO) {
        try {
            val mimeType = resolver.getType(uri) ?: "application/octet-stream"
            val fileName = uri.lastPathSegment?.substringAfterLast('/') ?: "file"
            val rawBytes = resolver.openInputStream(uri)?.use { input ->
                val out = ByteArrayOutputStream()
                input.copyTo(out)
                out.toByteArray()
            } ?: return@withContext null
            if (rawBytes.isEmpty()) return@withContext null

            // Compress images for Socket.IO transport (raw photos are too large)
            val finalBytes: ByteArray
            val finalMime: String
            if (mimeType.startsWith("image/")) {
                val bitmap = android.graphics.BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size)
                    ?: return@withContext null
                val maxDim = 1024f
                val ratio = minOf(maxDim / bitmap.width, maxDim / bitmap.height, 1f)
                val scaledBitmap = if (ratio < 1f) {
                    android.graphics.Bitmap.createScaledBitmap(
                        bitmap,
                        (bitmap.width * ratio).toInt(),
                        (bitmap.height * ratio).toInt(),
                        true,
                    )
                } else {
                    bitmap
                }
                val compressStream = ByteArrayOutputStream()
                scaledBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, compressStream)
                if (scaledBitmap !== bitmap) scaledBitmap.recycle()
                bitmap.recycle()
                finalBytes = compressStream.toByteArray()
                finalMime = "image/jpeg"
            } else {
                finalBytes = rawBytes
                finalMime = mimeType
            }

            if (finalBytes.size > 2_000_000) return@withContext null // 2MB max after compression
            val base64 = Base64.encodeToString(finalBytes, Base64.NO_WRAP)
            PendingChatAttachment(
                id = uri.toString() + "#" + System.currentTimeMillis(),
                fileName = fileName,
                mimeType = finalMime,
                base64 = base64,
            )
        } catch (_: Exception) { null }
    }
}

private fun agentStatusColor(status: AgentStatus): androidx.compose.ui.graphics.Color = when (status) {
    AgentStatus.RUNNING -> androidx.compose.ui.graphics.Color(0xFF4CAF50)
    AgentStatus.STOPPED -> androidx.compose.ui.graphics.Color.Gray
    AgentStatus.PENDING -> androidx.compose.ui.graphics.Color(0xFFFFC107)
    AgentStatus.PROVISIONING -> androidx.compose.ui.graphics.Color(0xFFFFC107)
    AgentStatus.ERROR -> androidx.compose.ui.graphics.Color(0xFFF44336)
    AgentStatus.DELETING -> androidx.compose.ui.graphics.Color(0xFFF44336)
    AgentStatus.TERMINATED -> androidx.compose.ui.graphics.Color.Gray
}
