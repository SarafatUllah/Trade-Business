<template>
  <div class="field">
    <label :for="field.key">{{ field.label }}<span v-if="field.isRequired" class="req">*</span></label>

    <input
      v-if="['TEXT'].includes(field.type)"
      :id="field.key" type="text" :value="modelValue as string"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <textarea
      v-else-if="field.type === 'LONG_TEXT'"
      :id="field.key" rows="3" :value="modelValue as string"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else-if="['NUMBER', 'CURRENCY'].includes(field.type)"
      :id="field.key" type="number" step="0.01" :value="modelValue as number"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).valueAsNumber)"
    />
    <input
      v-else-if="field.type === 'DATE'"
      :id="field.key" type="date" :value="modelValue as string"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <input
      v-else-if="field.type === 'DATETIME'"
      :id="field.key" type="datetime-local" :value="modelValue as string"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <select
      v-else-if="['DROPDOWN', 'STATUS'].includes(field.type)"
      :id="field.key" :value="modelValue as string"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Select…</option>
      <option v-for="opt in parsedOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <label v-else-if="field.type === 'BOOLEAN'" class="checkbox-row">
      <input
        type="checkbox" :checked="!!modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span>Yes</span>
    </label>
    <div v-else-if="field.type === 'FORMULA'" class="formula-readonly num">
      {{ computedDisplay }}
      <small>calculated</small>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  field: { key: string; label: string; type: string; isRequired?: boolean; options?: string | null }
  modelValue: unknown
  computedValue?: unknown
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const parsedOptions = computed<{ value: string; label: string }[]>(() => {
  if (!props.field.options) return []
  try { return JSON.parse(props.field.options) } catch { return [] }
})

const computedDisplay = computed(() => {
  const v = props.computedValue
  if (v === null || v === undefined) return '—'
  return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v)
})
</script>

<style scoped>
.req { color: var(--overdue-600); margin-left: 2px; }
.checkbox-row { flex-direction: row !important; align-items: center; gap: 8px !important; }
.checkbox-row input { min-height: auto; width: 20px; height: 20px; }
.formula-readonly {
  padding: 12px;
  background: var(--paper-100);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 16px;
}
.formula-readonly small { color: var(--ink-400); font-family: var(--font-ui); }
</style>
