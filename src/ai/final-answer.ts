const INTERNAL_BLOCKS = /<(think|analysis)>[\s\S]*?<\/\1>/gi;
const UNCLOSED_INTERNAL_BLOCK = /<(?:think|analysis)>[\s\S]*$/i;
const FINAL_ANSWER_MARKER = /(?:respuesta final|final answer)\s*:\s*/gi;

export function sanitizeFinalAnswer(value: string): string {
  let answer = value
    .replace(INTERNAL_BLOCKS, "")
    .replace(UNCLOSED_INTERNAL_BLOCK, "")
    .trim();

  const markers = [...answer.matchAll(FINAL_ANSWER_MARKER)];
  const lastMarker = markers.at(-1);
  if (lastMarker?.index !== undefined) {
    answer = answer.slice(lastMarker.index + lastMarker[0].length).trim();
  }

  return answer;
}
