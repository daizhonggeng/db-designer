
const API_KEY = import.meta.env.VITE_AI_API_KEY;
const API_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export async function generateSchema(description, imageBase64 = null) {
  const isVision = !!imageBase64;
  const MODEL_NAME = isVision ? "qwen3-vl-plus" : "qwen3-max";

  const systemPrompt = `
You are a database architect. Your task is to generate a database schema based on the user's description${isVision ? ' and the provided ER diagram/image' : ''}.

1. First, analyze the requirements and explain your reasoning.
2. Then, generate the JSON schema wrapped in \`\`\`json ... \`\`\` code blocks.

The JSON must strictly follow this structure:
{
  "tables": [
    {
      "id": "unique_string_id",
      "name": "table_name",
      "comment": "description_in_chinese_simplified",
      "position": { "x": 100, "y": 100 },
      "columns": [
        { "id": "unique_col_id", "name": "column_name", "type": "SQL_TYPE", "isPk": boolean, "comment": "description_in_chinese_simplified" }
      ]
    }
  ],
  "relationships": [
    { "id": "unique_rel_id", "fromTable": "table_id", "fromCol": "col_id", "toTable": "table_id", "toCol": "col_id" }
  ]
}
Ensure you generate appropriate Foreign Keys and relationships.
Arrange the "position" of tables so they don't overlap, spreading them out visually.
IMPORTANT: You MUST provide meaningful comments in Chinese (Simplified) for every table and column in the "comment" field.
`;

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  if (isVision) {
    messages.push({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageBase64 } },
        { type: "text", text: description || "Analyze this database diagram and generate the schema JSON." }
      ]
    });
  } else {
    messages.push({ role: "user", content: `Design a database schema for: ${description}` });
  }

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: messages,
        stream: true, // Enable streaming for reasoning
        extra_body: {
          enable_thinking: true,
          thinking_budget: 16384 // Adjusted budget
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "API request failed");
    }

    // Handle Streaming Response
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let reasoning = "";
    let content = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '');
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices[0].delta;

            // Capture Reasoning
            if (delta.reasoning_content) {
              reasoning += delta.reasoning_content;
            }

            // Capture Content
            if (delta.content) {
              content += delta.content;
            }
          } catch (e) {
            console.error("Error parsing stream chunk", e);
          }
        }
      }
    }

    // Parse JSON from content
    const jsonMatch = content.match(/```json([\s\S]*?)```/);
    let jsonContent = jsonMatch ? jsonMatch[1] : content;
    jsonContent = jsonContent.replace(/```/g, "").trim(); // Extra cleanup

    return {
      reasoning: reasoning || "No reasoning provided by model.",
      schema: JSON.parse(jsonContent)
    };

  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
