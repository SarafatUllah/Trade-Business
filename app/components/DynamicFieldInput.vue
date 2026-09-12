<template>
  <div class="field">
    <label :for="field.key">{{ field.label }}<span v-if="field.isRequired" class="req">*</span></label>

    <input
      v-if="['TEXT'].includes(field.type)"
      :id="field.key" type="text" :value="modelValue as string" :class="{ invalid: showError }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @blur="touched = true"
    />
    <textarea
      v-else-if="field.type === 'LONG_TEXT'"
      :id="field.key" rows="3" :value="modelValue as string" :class="{ invalid: showError }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" @blur="touched = true"
    />
    <input
      v-else-if="['NUMBER', 'CURRENCY'].includes(field.type)"
      :id="field.key" type="number" step="0.01" :value="modelValue as number" :class="{ invalid: showError }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).valueAsNumber)" @blur="touched = true"
    />
    <input
      v-else-if="field.type === 'DATE'"
      :id="field.key" type="date" :value="modelValue as string" :class="{ invalid: showError }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @blur="touched = true"
    />
    <input
      v-else-if="field.type === 'DATETIME'"
      :id="field.key" type="datetime-local" :value="modelValue as string" :class="{ invalid: showError }"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @blur="touched = true"
    />
    <select
      v-else-if="['DROPDOWN', 'STATUS'].includes(field.type)"
      :id="field.key" :value="modelValue as string" :class="{ invalid: showError }"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)" @blur="touched = true"
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
    <div v-else-if="field.type === 'AUTO_STATUS'" class="status-readonly">
      <span class="status-pill" :class="statusPillClass">{{ statusLabel }}</span>
      <small>auto</small>
    </div>

    <FieldMessage v-if="showError" type="error" :message="`${field.label} is required`" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  field: { key: string; label: string; type: string; isRequired?: boolean; options?: string | null }
  modelValue: unknown
  computedValue?: unknown
  forceValidate?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const touched = ref(false)

const parsedOptions = computed<{ value: string; label: string }[]>(() => {
  if (!props.field.options) return []
  try { return JSON.parse(props.field.options) } catch { return [] }
})

const isEmpty = computed(() => {
  const v = props.modelValue
  return v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))
})

const showError = computed(() =>
  !!props.field.isRequired && isEmpty.value && (touched.value || !!props.forceValidate)
)

const computedDisplay = computed(() => {
  const v = props.computedValue
  if (v === null || v === undefined) return '—'
  return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v)
})

const statusLabel = computed(() => {
  const v = props.computedValue as string | null
  if (v === 'PAID') return 'Paid'
  if (v === 'PARTIALLY_PAID') return 'Partially Paid'
  if (v === 'UNPAID') return 'Unpaid'
  return '—'
})
const statusPillClass = computed(() => {
  const v = props.computedValue as string | null
  if (v === 'PAID') return 'paid'
  if (v === 'PARTIALLY_PAID') return 'partial'
  if (v === 'UNPAID') return 'unpaid'
  return 'none'
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
.status-readonly {
  padding: 12px;
  background: var(--paper-100);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.status-readonly small { color: var(--ink-400); }
.status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
.status-pill.paid { background: var(--receivable-100); color: var(--receivable-600); }
.status-pill.partial { background: var(--payable-100); color: var(--payable-600); }
.status-pill.unpaid { background: var(--overdue-100); color: var(--overdue-600); }
.status-pill.none { background: var(--paper-100); color: var(--ink-400); }
</style>
