export type SimNao = "" | "nao" | "sim";

export interface Participante {
  id?: string;
  created_at?: string;

  // Dados pessoais
  nome_completo: string;
  nome_documento: string;
  data_nascimento: string;
  cpf: string;
  rg: string;
  sexo: "" | "Masculino" | "Feminino";
  empresa_rede: string;
  cargo: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  documento_embarque: "" | "RG" | "CNH";
  numero_documento: string;

  // Saúde / hospedagem
  restricao_alimentar: SimNao;
  restricao_alimentar_qual: string;
  alergia: SimNao;
  alergia_qual: string;
  tratamento_medico: SimNao;
  tratamento_medico_qual: string;
  uso_continuo_medicamentos: SimNao;
  uso_continuo_medicamentos_quais: string;
  medicacao_pressao: SimNao;
  medicacao_colesterol: SimNao;
  cirurgia_12_meses: SimNao;
  cirurgia_12_meses_qual: string;
  condicao_medica: SimNao;
  condicao_medica_qual: string;

  // Kit
  tamanho_camiseta: "" | "P" | "M" | "G" | "GG" | "XGG";
  tamanho_calcado: string;

  // Foto
  foto_url: string;

  // Contato de emergência
  emergencia_nome: string;
  emergencia_parentesco: string;
  emergencia_telefone: string;

  // Termo
  aceite_termo: boolean;
}

export const emptyParticipante: Participante = {
  nome_completo: "",
  nome_documento: "",
  data_nascimento: "",
  cpf: "",
  rg: "",
  sexo: "",
  empresa_rede: "",
  cargo: "",
  telefone: "",
  email: "",
  cidade: "",
  estado: "",
  documento_embarque: "",
  numero_documento: "",
  restricao_alimentar: "",
  restricao_alimentar_qual: "",
  alergia: "",
  alergia_qual: "",
  tratamento_medico: "",
  tratamento_medico_qual: "",
  uso_continuo_medicamentos: "",
  uso_continuo_medicamentos_quais: "",
  medicacao_pressao: "",
  medicacao_colesterol: "",
  cirurgia_12_meses: "",
  cirurgia_12_meses_qual: "",
  condicao_medica: "",
  condicao_medica_qual: "",
  tamanho_camiseta: "",
  tamanho_calcado: "",
  foto_url: "",
  emergencia_nome: "",
  emergencia_parentesco: "",
  emergencia_telefone: "",
  aceite_termo: false,
};

export const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];
