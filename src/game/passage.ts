// Standard common-words passage generator (MonkeyType-style).

const WORDS = [
  "the", "of", "and", "to", "in", "is", "you", "that", "it", "he", "was", "for",
  "on", "are", "as", "with", "his", "they", "at", "be", "this", "have", "from",
  "or", "one", "had", "by", "word", "but", "not", "what", "all", "were", "we",
  "when", "your", "can", "said", "there", "use", "an", "each", "which", "she",
  "do", "how", "their", "if", "will", "up", "other", "about", "out", "many",
  "then", "them", "these", "so", "some", "her", "would", "make", "like", "him",
  "into", "time", "has", "look", "two", "more", "write", "go", "see", "number",
  "no", "way", "could", "people", "than", "first", "water", "been", "call",
  "who", "now", "find", "long", "down", "day", "did", "get", "come", "made",
  "may", "part", "over", "new", "sound", "take", "only", "little", "work",
  "know", "place", "year", "live", "me", "back", "give", "most", "very",
  "after", "thing", "our", "just", "name", "good", "sentence", "man", "think",
  "say", "great", "where", "help", "through", "much", "before", "line", "right",
  "too", "mean", "old", "any", "same", "tell", "boy", "follow", "came", "want",
  "show", "also", "around", "form", "three", "small", "set", "put", "end",
  "does", "another", "well", "large", "must", "big", "even", "such", "because",
]

/** Generates a passage of `count` random common words joined by spaces. */
export function generatePassage(count = 40): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(WORDS[Math.floor(Math.random() * WORDS.length)])
  }
  return out.join(" ")
}
