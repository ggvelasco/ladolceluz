import type { InputHTMLAttributes, ReactNode } from 'react'
import type { PassengerData } from '../lib/api'
import { cx, isValidCpf, maskCpf, maskPhone, onlyDigits } from '../lib/format'

/** Estado do formulário: igual ao que vai para a API, mas Sim/Não começam sem resposta. */
export interface PassengerForm {
  nome: string
  cpf: string
  emergenciaNome: string
  emergenciaTelefone: string
  hospital: string
  convenio: string
  temAlergia: boolean | null
  alergias: string
  temNecessidade: boolean | null
  necessidade: string
}

export type PassengerErrors = Partial<Record<keyof PassengerForm, string>>

export const EMPTY_PASSENGER: PassengerForm = {
  nome: '',
  cpf: '',
  emergenciaNome: '',
  emergenciaTelefone: '',
  hospital: '',
  convenio: '',
  temAlergia: null,
  alergias: '',
  temNecessidade: null,
  necessidade: '',
}

export function validatePassenger(form: PassengerForm): PassengerErrors {
  const errors: PassengerErrors = {}
  const words = form.nome.trim().split(/\s+/).filter((part) => part.length > 1)
  if (words.length < 2) errors.nome = 'Informe o nome completo.'
  if (!isValidCpf(form.cpf)) errors.cpf = 'Confira o CPF: esse número não é válido.'
  if (form.emergenciaNome.trim().length < 2) errors.emergenciaNome = 'Quem devemos avisar?'
  if (onlyDigits(form.emergenciaTelefone).length < 10) errors.emergenciaTelefone = 'Informe um telefone com DDD.'
  if (form.temAlergia === null) errors.temAlergia = 'Selecione uma opção.'
  else if (form.temAlergia && !form.alergias.trim()) errors.alergias = 'Conta pra gente quais são.'
  if (form.temNecessidade === null) errors.temNecessidade = 'Selecione uma opção.'
  else if (form.temNecessidade && !form.necessidade.trim()) errors.necessidade = 'Descreva para a gente se preparar.'
  return errors
}

export function toPassengerData(form: PassengerForm): PassengerData {
  return {
    nome: form.nome.trim(),
    cpf: onlyDigits(form.cpf),
    emergenciaNome: form.emergenciaNome.trim(),
    emergenciaTelefone: onlyDigits(form.emergenciaTelefone),
    hospital: form.hospital.trim(),
    convenio: form.convenio.trim(),
    temAlergia: form.temAlergia === true,
    alergias: form.temAlergia ? form.alergias.trim() : '',
    temNecessidade: form.temNecessidade === true,
    necessidade: form.temNecessidade ? form.necessidade.trim() : '',
  }
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  optional?: boolean
}

function TextField({ id, label, value, onChange, error, optional, ...input }: TextFieldProps) {
  return (
    <div className={cx('field', error && 'field--error')}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="field__optional">opcional</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
        {...input}
      />
      {error && (
        <p className="field__error" id={`${id}-erro`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface YesNoProps {
  id: string
  legend: string
  value: boolean | null
  onChange: (value: boolean) => void
  error?: string
  /** Campo que abre quando a resposta é "Sim". */
  children: ReactNode
}

function YesNo({ id, legend, value, onChange, error, children }: YesNoProps) {
  return (
    <div className={cx('yesno', error && 'yesno--error')} role="radiogroup" aria-labelledby={`${id}-rotulo`}>
      <div className="yesno__row">
        <span className="yesno__legend" id={`${id}-rotulo`}>
          {legend}
        </span>
        <div className="yesno__options">
          {[true, false].map((option) => (
            <label key={String(option)} className="yesno__option">
              <input
                type="radio"
                name={id}
                checked={value === option}
                onChange={() => onChange(option)}
                aria-describedby={error ? `${id}-erro` : undefined}
              />
              <span>{option ? 'Sim' : 'Não'}</span>
            </label>
          ))}
        </div>
      </div>
      {error && (
        <p className="field__error" id={`${id}-erro`} role="alert">
          {error}
        </p>
      )}
      <div className={cx('reveal', value === true && 'is-open')}>
        <div className="reveal__inner">{children}</div>
      </div>
    </div>
  )
}

interface TextAreaProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled: boolean
}

function TextArea({ id, label, value, onChange, error, disabled }: TextAreaProps) {
  return (
    <div className={cx('field', error && 'field--error')}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={2}
        maxLength={600}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
      />
      {error && (
        <p className="field__error" id={`${id}-erro`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface PassengerFieldsProps {
  /** Prefixo dos ids, para titular e acompanhante não colidirem. */
  id: string
  value: PassengerForm
  errors: PassengerErrors
  onChange: (value: PassengerForm) => void
  /** Preenchimento automático do navegador só faz sentido para quem está digitando os próprios dados. */
  self?: boolean
}

export function PassengerFields({ id, value, errors, onChange, self }: PassengerFieldsProps) {
  const set = <K extends keyof PassengerForm>(key: K, next: PassengerForm[K]) => onChange({ ...value, [key]: next })

  return (
    <div className="fields">
      <TextField
        id={`${id}-nome`}
        label="Nome completo"
        value={value.nome}
        onChange={(next) => set('nome', next)}
        error={errors.nome}
        autoComplete={self ? 'name' : 'off'}
        maxLength={120}
      />
      <TextField
        id={`${id}-cpf`}
        label="CPF"
        value={value.cpf}
        onChange={(next) => set('cpf', maskCpf(next))}
        error={errors.cpf}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
      />

      <fieldset className="fields__group">
        <legend>Contato de emergência</legend>
        <TextField
          id={`${id}-emergencia-nome`}
          label="Nome"
          value={value.emergenciaNome}
          onChange={(next) => set('emergenciaNome', next)}
          error={errors.emergenciaNome}
          autoComplete="off"
          maxLength={120}
        />
        <TextField
          id={`${id}-emergencia-telefone`}
          label="Telefone"
          value={value.emergenciaTelefone}
          onChange={(next) => set('emergenciaTelefone', maskPhone(next))}
          error={errors.emergenciaTelefone}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(00) 00000-0000"
        />
      </fieldset>

      <TextField
        id={`${id}-hospital`}
        label="Hospital de referência"
        value={value.hospital}
        onChange={(next) => set('hospital', next)}
        optional
        autoComplete="off"
        maxLength={160}
      />
      <TextField
        id={`${id}-convenio`}
        label="Convênio médico"
        value={value.convenio}
        onChange={(next) => set('convenio', next)}
        optional
        autoComplete="off"
        maxLength={160}
      />

      <YesNo
        id={`${id}-alergia`}
        legend="Alergias?"
        value={value.temAlergia}
        onChange={(next) => set('temAlergia', next)}
        error={errors.temAlergia}
      >
        <TextArea
          id={`${id}-alergias`}
          label="Conta pra gente quais:"
          value={value.alergias}
          onChange={(next) => set('alergias', next)}
          error={errors.alergias}
          disabled={value.temAlergia !== true}
        />
      </YesNo>

      <YesNo
        id={`${id}-necessidade`}
        legend="Necessidade especial?"
        value={value.temNecessidade}
        onChange={(next) => set('temNecessidade', next)}
        error={errors.temNecessidade}
      >
        <TextArea
          id={`${id}-necessidade-qual`}
          label="Especifique qual e se precisa de suporte no transfer ou no local:"
          value={value.necessidade}
          onChange={(next) => set('necessidade', next)}
          error={errors.necessidade}
          disabled={value.temNecessidade !== true}
        />
      </YesNo>
    </div>
  )
}
