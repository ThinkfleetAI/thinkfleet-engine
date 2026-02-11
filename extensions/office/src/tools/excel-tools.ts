import { createAction, createBatch, type OfficeActionBatch } from "./shared-types.js";

/**
 * Excel agent tools.
 *
 * Each tool generates an OfficeActionBatch that gets sent to the add-in
 * via the SaaS outbound service. The add-in then executes the actions
 * using Office.js in a single batched Excel.run().
 *
 * The tool results include the action batch in metadata.actionBatch,
 * which the outbound service picks up and sends to the add-in.
 */

interface AgentTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (input: Record<string, unknown>) => Promise<{
		content: string;
		metadata?: Record<string, unknown>;
	}>;
}

export function createExcelTools(): AgentTool[] {
	return [
		{
			name: "office_excel_write_data",
			description:
				"Write values to cells in an Excel worksheet. Use this to populate data, build tables, or update existing content. Provide a 2D array of values matching the target range dimensions.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: 'Target range address (e.g., "A1:D10")' },
					values: {
						type: "array",
						items: { type: "array", items: {} },
						description: "2D array of values to write, rows then columns",
					},
					numberFormat: {
						type: "array",
						items: { type: "array", items: { type: "string" } },
						description: 'Optional number format array (e.g., [["$#,##0.00"]])',
					},
				},
				required: ["sheet", "range", "values"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.writeRange", input, `Write data to ${input.sheet}!${input.range}`)],
					`Writing data to ${input.sheet}!${input.range}`,
				);
				return {
					content: `Writing ${(input.values as unknown[][]).length} rows to ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_read_data",
			description:
				"Read values from a range in an Excel worksheet. Returns the current values, formulas, and number formats. Use this to understand what data is in the workbook before making changes.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: 'Range address to read (e.g., "A1:D10")' },
				},
				required: ["sheet", "range"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.readRange", input, `Read ${input.sheet}!${input.range}`)],
					`Reading data from ${input.sheet}!${input.range}`,
				);
				return {
					content: `Reading data from ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_format_cells",
			description:
				"Apply formatting to cells: bold, italic, font size, font color, fill color, number format, alignment, borders. Use this to make data visually clear and professional.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Range to format" },
					format: {
						type: "object",
						description: "Formatting to apply",
						properties: {
							bold: { type: "boolean" },
							italic: { type: "boolean" },
							underline: { type: "boolean" },
							fontSize: { type: "number" },
							fontColor: { type: "string", description: 'Color hex (e.g., "#FF0000")' },
							fill: { type: "string", description: 'Background color hex (e.g., "#4472C4")' },
							numberFormat: { type: "string", description: 'e.g., "$#,##0.00", "0%", "yyyy-mm-dd"' },
							horizontalAlignment: { type: "string", enum: ["general", "left", "center", "right"] },
							verticalAlignment: { type: "string", enum: ["top", "center", "bottom"] },
							wrapText: { type: "boolean" },
							borders: {
								type: "object",
								properties: {
									top: { type: "object", properties: { style: { type: "string" }, color: { type: "string" } } },
									bottom: { type: "object", properties: { style: { type: "string" }, color: { type: "string" } } },
									left: { type: "object", properties: { style: { type: "string" }, color: { type: "string" } } },
									right: { type: "object", properties: { style: { type: "string" }, color: { type: "string" } } },
								},
							},
						},
					},
				},
				required: ["sheet", "range", "format"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.formatRange", input, `Format ${input.sheet}!${input.range}`)],
					`Formatting ${input.sheet}!${input.range}`,
				);
				return {
					content: `Applying formatting to ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_set_formulas",
			description:
				"Set Excel formulas on cells. Provide a 2D array of formula strings. Each formula must start with '='.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Target range" },
					formulas: {
						type: "array",
						items: { type: "array", items: { type: "string" } },
						description: '2D array of formulas (e.g., [["=SUM(A1:A10)"], ["=AVERAGE(B1:B10)"]])',
					},
				},
				required: ["sheet", "range", "formulas"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.setFormulas", input, `Set formulas in ${input.sheet}!${input.range}`)],
					`Setting formulas in ${input.sheet}!${input.range}`,
				);
				return {
					content: `Setting formulas in ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_create_chart",
			description:
				"Create a chart from data in the workbook. Supports bar, line, pie, scatter, area, radar, histogram, waterfall, treemap, sunburst, funnel, and doughnut chart types.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet where the chart will be placed" },
					dataRange: { type: "string", description: "Source data range (e.g., 'A1:D10')" },
					chartType: {
						type: "string",
						description: "Chart type",
						enum: [
							"ColumnClustered", "ColumnStacked", "BarClustered", "BarStacked",
							"Line", "LineMarkers", "Pie", "Doughnut", "Scatter",
							"Area", "AreaStacked", "Radar", "Histogram",
							"Waterfall", "Treemap", "Sunburst", "Funnel",
						],
					},
					title: { type: "string", description: "Chart title" },
					position: {
						type: "object",
						properties: {
							left: { type: "number", description: "Left position in points" },
							top: { type: "number", description: "Top position in points" },
						},
					},
					size: {
						type: "object",
						properties: {
							width: { type: "number", description: "Width in points" },
							height: { type: "number", description: "Height in points" },
						},
					},
				},
				required: ["sheet", "dataRange", "chartType"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.createChart", input, `Create ${input.chartType} chart from ${input.dataRange}`)],
					`Creating ${input.chartType} chart from ${input.dataRange}`,
				);
				return {
					content: `Creating ${input.chartType} chart titled "${input.title ?? "Chart"}" from ${input.dataRange}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_create_table",
			description:
				"Create a formatted Excel table from a range. Tables have automatic filtering, sorting, and styling.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Range to convert to a table" },
					hasHeaders: { type: "boolean", description: "Whether the first row contains headers (default: true)" },
					name: { type: "string", description: "Table name (optional)" },
					style: { type: "string", description: 'Table style (e.g., "TableStyleMedium2", "TableStyleLight1")' },
				},
				required: ["sheet", "range"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.createTable", input, `Create table from ${input.sheet}!${input.range}`)],
					`Creating Excel table from ${input.sheet}!${input.range}`,
				);
				return {
					content: `Creating table "${input.name ?? "auto"}" from ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_manage_sheets",
			description:
				"Add, rename, delete, or activate worksheets in the workbook.",
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["add", "rename", "delete", "activate"], description: "Action to perform" },
					name: { type: "string", description: "Sheet name (target for rename/delete/activate, new name for add)" },
					newName: { type: "string", description: "New name (only for rename action)" },
					position: { type: "number", description: "Position index (only for add action)" },
				},
				required: ["action", "name"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.manageSheets", input, `${input.action} sheet "${input.name}"`)],
					`${input.action === "add" ? "Adding" : input.action === "rename" ? "Renaming" : input.action === "delete" ? "Deleting" : "Activating"} sheet "${input.name}"`,
				);
				return {
					content: `Sheet action: ${input.action} "${input.name}"`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_filter_sort",
			description:
				"Sort data in a range by one or more columns. Specify column indices (0-based) and sort direction.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Range to sort" },
					sortColumns: {
						type: "array",
						items: {
							type: "object",
							properties: {
								column: { type: "number", description: "0-based column index to sort by" },
								ascending: { type: "boolean", description: "Sort ascending (default: true)" },
							},
							required: ["column"],
						},
						description: "Columns to sort by, in order of priority",
					},
				},
				required: ["sheet", "range", "sortColumns"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.filterSort", input, `Sort ${input.sheet}!${input.range}`)],
					`Sorting ${input.sheet}!${input.range}`,
				);
				return {
					content: `Sorting ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_create_pivot",
			description:
				"Create a PivotTable from data in the workbook. Requires Excel 2019+ (ExcelApi 1.8). Specify row fields, column fields, value fields with aggregation functions, and optional filter fields.",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Source data worksheet" },
					sourceRange: { type: "string", description: "Source data range" },
					destinationSheet: { type: "string", description: "Destination sheet name (created if needed)" },
					destinationRange: { type: "string", description: "Destination cell (default: A1)" },
					name: { type: "string", description: "PivotTable name" },
					config: {
						type: "object",
						properties: {
							rows: { type: "array", items: { type: "string" }, description: "Row field names" },
							columns: { type: "array", items: { type: "string" }, description: "Column field names" },
							values: {
								type: "array",
								items: {
									type: "object",
									properties: {
										field: { type: "string" },
										function: { type: "string", enum: ["sum", "count", "average", "max", "min"] },
									},
									required: ["field"],
								},
								description: "Value fields with aggregation",
							},
							filters: { type: "array", items: { type: "string" }, description: "Filter field names" },
						},
						required: ["rows", "values"],
					},
				},
				required: ["sheet", "sourceRange", "config"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.createPivot", input, `Create PivotTable from ${input.sheet}!${input.sourceRange}`)],
					`Creating PivotTable from ${input.sheet}!${input.sourceRange}`,
				);
				return {
					content: `Creating PivotTable from ${input.sheet}!${input.sourceRange}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_conditional_format",
			description:
				"Add conditional formatting to highlight cells based on their values. Supports color scales, data bars, icon sets, cell value rules, top/bottom rules, and custom formula rules. Requires Excel 2016+ (ExcelApi 1.6).",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Range to apply conditional formatting" },
					rule: {
						type: "object",
						properties: {
							type: {
								type: "string",
								enum: ["colorScale", "dataBar", "iconSet", "cellValue", "topBottom", "custom"],
							},
							params: {
								type: "object",
								description: "Rule-specific parameters (varies by type)",
							},
						},
						required: ["type", "params"],
					},
				},
				required: ["sheet", "range", "rule"],
			},
			execute: async (input) => {
				const rule = input.rule as { type: string };
				const batch = createBatch(
					[createAction("excel", "excel.conditionalFormat", input, `Add ${rule.type} formatting to ${input.sheet}!${input.range}`)],
					`Adding ${rule.type} conditional formatting to ${input.sheet}!${input.range}`,
				);
				return {
					content: `Adding ${rule.type} conditional formatting to ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_data_validation",
			description:
				"Set data validation rules on cells to restrict what users can enter. Supports dropdown lists, number ranges, dates, text length, and custom formula validation. Requires Excel 2019+ (ExcelApi 1.8).",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					range: { type: "string", description: "Range to validate" },
					rule: {
						type: "object",
						properties: {
							type: { type: "string", enum: ["list", "wholeNumber", "decimal", "date", "textLength", "custom"] },
							params: { type: "object", description: "Rule parameters (e.g., { source: ['Yes','No'] } for list)" },
							errorMessage: { type: "string", description: "Error message shown for invalid input" },
							promptMessage: { type: "string", description: "Prompt shown when cell is selected" },
						},
						required: ["type", "params"],
					},
				},
				required: ["sheet", "range", "rule"],
			},
			execute: async (input) => {
				const rule = input.rule as { type: string };
				const batch = createBatch(
					[createAction("excel", "excel.dataValidation", input, `Set ${rule.type} validation on ${input.sheet}!${input.range}`)],
					`Setting ${rule.type} data validation on ${input.sheet}!${input.range}`,
				);
				return {
					content: `Setting ${rule.type} validation on ${input.sheet}!${input.range}`,
					metadata: { actionBatch: batch },
				};
			},
		},

		{
			name: "office_excel_insert_shape",
			description:
				"Insert a geometric shape into a worksheet. Shapes can contain text and be styled with fill and line colors. Requires Excel 2019+ (ExcelApi 1.9).",
			inputSchema: {
				type: "object",
				properties: {
					sheet: { type: "string", description: "Worksheet name" },
					shapeType: {
						type: "string",
						enum: ["Rectangle", "RoundedRectangle", "Ellipse", "Triangle", "Diamond", "Pentagon", "Hexagon", "Octagon", "Star5", "Arrow", "Heart", "Cloud"],
						description: "Type of geometric shape",
					},
					position: {
						type: "object",
						properties: {
							left: { type: "number", description: "Left position in points" },
							top: { type: "number", description: "Top position in points" },
						},
						required: ["left", "top"],
					},
					size: {
						type: "object",
						properties: {
							width: { type: "number", description: "Width in points" },
							height: { type: "number", description: "Height in points" },
						},
						required: ["width", "height"],
					},
					text: { type: "string", description: "Text to display inside the shape" },
					fill: { type: "string", description: "Fill color hex (e.g., '#4472C4')" },
					lineColor: { type: "string", description: "Outline color hex" },
				},
				required: ["sheet", "shapeType", "position", "size"],
			},
			execute: async (input) => {
				const batch = createBatch(
					[createAction("excel", "excel.insertShape", input, `Insert ${input.shapeType} shape`)],
					`Inserting ${input.shapeType} shape on ${input.sheet}`,
				);
				return {
					content: `Inserting ${input.shapeType} shape on ${input.sheet}`,
					metadata: { actionBatch: batch },
				};
			},
		},
	];
}
