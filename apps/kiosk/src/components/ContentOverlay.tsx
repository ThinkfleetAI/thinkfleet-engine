interface ContentOverlayProps {
  content: {
    contentType: "url" | "receipt";
    payload: Record<string, unknown>;
  };
  onDismiss: () => void;
}

export function ContentOverlay({ content, onDismiss }: ContentOverlayProps) {
  if (content.contentType === "url") {
    return (
      <div style={styles.overlay} onClick={onDismiss}>
        <div style={styles.iframeContainer} onClick={(e) => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={onDismiss}>✕</button>
          <iframe
            src={content.payload.url as string}
            style={styles.iframe}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    );
  }

  // Receipt card
  return (
    <div style={styles.overlay} onClick={onDismiss}>
      <div style={styles.receiptCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onDismiss}>✕</button>
        <h3 style={styles.receiptTitle}>{(content.payload.title as string) || "Receipt"}</h3>
        <pre style={styles.receiptBody}>{JSON.stringify(content.payload, null, 2)}</pre>
        <p style={styles.tapHint}>Tap outside to dismiss</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  iframeContainer: {
    width: "90%",
    height: "85%",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    background: "white",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.6)",
    color: "white",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCard: {
    background: "rgba(30,41,59,0.95)",
    borderRadius: 16,
    padding: 32,
    maxWidth: "80%",
    maxHeight: "80%",
    overflow: "auto",
    position: "relative",
  },
  receiptTitle: {
    color: "white",
    fontSize: 24,
    marginBottom: 16,
  },
  receiptBody: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
  },
  tapHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
};
