import { createRng, writeTopicFile } from "./ch6_common.js";
import { generate as basic } from "./ch6_basic_ratio.js";
import { generate as challenging } from "./ch6_challenging_ratio.js";
import { generate as conversion } from "./ch6_conversion.js";
import { generate as percent } from "./ch6_percent.js";
import { generate as percentage } from "./ch6_percentage_problems.js";

const generators: Record<
  string,
  (rng: () => number) => Record<"easy" | "medium" | "hard", any[]>
> = {
  "ch6.basic_ratio": basic,
  "ch6.challenging_ratio": challenging,
  "ch6.conversion_factors": conversion,
  "ch6.percent": percent,
  "ch6.percentage_problems": percentage,
};

for (const [topic, gen] of Object.entries(generators)) {
  for (const diff of ["easy", "medium", "hard"] as const) {
    const rng = createRng(`${topic}.${diff}`);
    const problems = gen(rng)[diff];
    writeTopicFile(topic, diff, problems);
  }
}

console.log("Chapter 6 generation complete.");
