<script setup lang="ts">
// One paragraph or list item of a legal text (LegalSections): **bold** and
// `code` are marked up, and each line break is kept. Plain text only, never HTML.
const props = defineProps<{ text: string }>()

type Segment = { text: string, kind: 'plain' | 'bold' | 'code' }

// Splits one line of text into its plain, bold and code parts.
function segments(line: string): Segment[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((part): Segment => {
    if (part.startsWith('**')) return { text: part.slice(2, -2), kind: 'bold' }
    if (part.startsWith('`')) return { text: part.slice(1, -1), kind: 'code' }
    return { text: part, kind: 'plain' }
  })
}

// The text as its lines, each as segments.
function lines(text: string): Segment[][] {
  return text.split('\n').map(segments)
}

const rendered = computed(() => lines(props.text))
</script>

<template>
  <template
    v-for="(line, lineIndex) in rendered"
    :key="lineIndex"
  >
    <br v-if="lineIndex > 0">
    <template
      v-for="(part, partIndex) in line"
      :key="partIndex"
    >
      <strong v-if="part.kind === 'bold'">{{ part.text }}</strong>
      <code
        v-else-if="part.kind === 'code'"
        class="rounded bg-surface-muted px-1 font-mono text-small"
      >{{ part.text }}</code>
      <template v-else>{{ part.text }}</template>
    </template>
  </template>
</template>
