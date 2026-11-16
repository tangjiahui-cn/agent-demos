/**
 * ReAct
 */
import "dotenv/config";
import { ChatDeepSeek } from "@langchain/deepseek";
import { tool } from "langchain";
import { z } from "zod";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

// tools
const getWeather = tool(
  async ({ city }: { city: string }) => {
    const mockWeather: Record<string, string> = {
      北京: "小雨，气温 12℃，东北风 3 级",
      上海: "晴，气温 22℃，微风",
    };
    return mockWeather[city] ?? `未找到 ${city} 的天气信息`;
  },
  {
    name: "get_weather",
    description: "查询指定城市的实时天气。",
    schema: z.object({
      city: z.string().describe("城市名称，例如：北京"),
    }),
  },
);

// bind tool to model.
const model = new ChatDeepSeek({
  model: "deepseek-flash",
  temperature: 0,
});

const modelWithTools = model.bindTools([getWeather]);

// ReAct
async function runReAct(
  messages: Array<SystemMessage | HumanMessage | ToolMessage | any>,
  maxRounds = 5,
) {
  for (let round = 0; round < maxRounds; round++) {
    console.log(`round ${round + 1}`);

    // invoke
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // if has tool_calls
    if (!response.tool_calls || response.tool_calls?.length === 0) {
      console.log("zz 最终回答：", response.content);
      break;
    }

    // 有 tool_calls,逐个执行
    for (const toolCall of response.tool_calls) {
      console.log("tool call: ", toolCall.name, toolCall.args);

      const tool = [getWeather].find((t) => t.name === toolCall.name);
      if (!tool) {
        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `未知工具：${toolCall.name}`,
          }),
        );
        continue;
      }

      const result = await tool.invoke(toolCall.args as any);
      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id!,
          content: String(result),
        }),
      );
    }
  }
}

runReAct([
  new SystemMessage("你是"),
  new HumanMessage("北京今天天气怎么样？出门需要带伞吗？"),
]);
