<script setup lang="ts">
import type { LegalBlock, LegalSection } from '~~/app/legal/text'

// The sections of a legal text (app/legal/): each heading, then its paragraphs
// or lists (LegalLine renders the text of each).
defineProps<{ sections: LegalSection[] }>()

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
            <LegalLine :text="item" />
          </li>
        </ul>
        <p
          v-else
          class="text-body"
        >
          <LegalLine :text="block" />
        </p>
      </template>
    </section>
  </div>
</template>
