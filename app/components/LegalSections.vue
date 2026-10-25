<script setup lang="ts">
import type { LegalBlock, LegalSection } from '~~/app/legal/text'

// The sections of a legal text (app/legal/): each heading, then its paragraphs
// or lists. Inside a paragraph, **bold** and `code` are marked up, and a line
// break is kept. Plain text only, never HTML.
defineProps<{ sections: LegalSection[] }>()

type Segment = { text: string, kind: 'plain' | 'bold' | 'code' }

// Splits one line of text into its plain, bold and code parts.
function segments(line: string): Segment[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((part): Segment => {
    if (part.startsWith('**')) return { text: part.slice(2, -2), kind: 'bold' }
    if (part.startsWith('`')) return { text: part.slice(1, -1), kind: 'code' }
    return { text: part, kind: 'plain' }
  })
}

// A paragraph as its lines, each as segments.
function lines(text: string): Segment[][] {
  return text.split('\n').map(segments)
}

function isList(block: LegalBlock): block is { list: string[] } {
  return typeof block !== 'string'
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <section
      v-for="section in sections"
      :key="section.heading"
      class="flex flex-col gap-3"
    >
      <h2 class="font-display text-title-m">
        {{ section.heading }}
      </h2>
      <template
        v-for="(block, index) in section.blocks"
        :key="index"
      >
        <ul
          v-if="isList(block)"
          class="flex list-disc flex-col gap-2 pl-5 text-body"
        >
          <li
            v-for="item in block.list"
            :key="item"
          >
            <template
              v-for="(line, lineIndex) in lines(item)"
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
          </li>
        </ul>
        <p
          v-else
          class="text-body"
        >
          <template
            v-for="(line, lineIndex) in lines(block)"
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
        </p>
      </template>
    </section>
  </div>
</template>
