/**
 * LangChain createAgent.
 * 
 * @description with summarizationMiddleware.
 */
import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatDeepSeek } from "@langchain/deepseek";
import { z } from "zod";
import { summarizationMiddleware } from "langchain";

// tools
const getWeather = tool(
  async ({ city }: { city: string }) => {
    const mockWeather: Record<string, string> = {
      北京: "小雨，气温 12℃，东北风 3 级",
      上海: "晴，气温 22℃，微风",
      广州: "多云，气温 28℃，南风 2 级",
    };

    return mockWeather[city] ?? `未找到 ${city} 的天气信息。`;
  },
  {
    name: "get_weather",
    description: "查询指定天气的实时天气",
    schema: z.object({
      city: z.string().describe("城市名称，例如：北京"),
    }),
  },
);

// model
const model = new ChatDeepSeek({
  model: "deepseek-flash",
  temperature: 0,
});

// agent
const agent = createAgent({
  model,
  tools: [getWeather],
  systemPrompt: `你是一个出行助手，根据用户询问的城市，调用工具查询天气，然后给出是否带伞、穿衣等建议。`,
  middleware: [
    summarizationMiddleware({
      model: new ChatDeepSeek({ model: "deepseek-flash", temperature: 0 }),
      trigger: { tokens: 100, messages: 6 }, // 故意设得很低，方便触发
      keep: { messages: 4 },
    }),
  ],
});

async function run() {
  const questions = [
    "北京今天天气怎么样？",
    "上海呢？",
    "广州呢？",
    "北京和上海哪个更适合出门？",
  ];

  const stream = await agent.stream(
    {
      messages: questions.map((q) => ({ role: "human", content: q })),
    },
    { streamMode: "debug" }, // 关键：输出所有内部事件
  );

  showLog(stream);
}

async function showLog(stream: any) {
  for await (const chunk of stream) {
    if (chunk.type === "task") {
      console.log("task");
      const inputMessages = chunk.payload?.input?.messages ?? [];
      inputMessages?.forEach?.((x: any) => {
        if (x?.additional_kwargs?.lc_source === "summarization") {
          console.log("summarization: ", x?.content);
        }
      });
    } else if (chunk.type === "task_result") {
      console.log(
        "task_result: ",
        chunk?.payload?.result?.messages?.map?.((x: any) => x?.content),
      );
    }
  }
}

run();
