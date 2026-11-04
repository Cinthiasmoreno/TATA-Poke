"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  rotuloDia,
  somarDias,
} from "@/lib/datas";

type Celula = { data: string; turno: Turno };

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  // Semana cujas escalas já chegaram do banco; diferente de "segunda" = carregando.
  const [semanaCarregada, setSemanaCarregada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(() =>
    variaveisConfiguradas() ? null : "O banco de dados não está configurado. Veja a página Início.",
  );
  const [celulaAberta, setCelulaAberta] = useState<Celula | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregando = semanaCarregada !== segunda;
  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);
  const hoje = hojeISO();

  // Turnos e funcionários: carregados uma vez.
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) return;
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro(`Não foi possível carregar os dados: ${(t.error ?? f.error)?.message}`);
        return;
      }
      setTurnos(t.data as Turno[]);
      setFuncionarios(f.data as Funcionario[]);
    }
    carregarBase();
  }, []);

  // Escala da semana: recarrega ao trocar de semana.
  useEffect(() => {
    let cancelado = false; // evita que uma semana antiga sobrescreva a atual
    async function buscarSemana() {
      if (!variaveisConfiguradas()) return;
      const { data, error } = await supabase()
        .from("escalas")
        .select("id, data, turno_id, funcionario_id")
        .gte("data", segunda)
        .lte("data", somarDias(segunda, 6));
      if (cancelado) return;
      if (error) setErro(`Não foi possível carregar a escala: ${error.message}`);
      else setEscalas(data as Escala[]);
      setSemanaCarregada(segunda);
    }
    buscarSemana();
    return () => {
      cancelado = true;
    };
  }, [segunda]);

  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  function escaladosNa(data: string, turnoId: string): Escala[] {
    return escalas.filter((e) => e.data === data && e.turno_id === turnoId);
  }

  async function alternar(funcionario: Funcionario) {
    if (!celulaAberta) return;
    const { data, turno } = celulaAberta;
    const existente = escalas.find(
      (e) => e.data === data && e.turno_id === turno.id && e.funcionario_id === funcionario.id,
    );
    setSalvandoId(funcionario.id);
    setErro(null);
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro(`Não foi possível tirar da escala: ${error.message}`);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro(`Não foi possível colocar na escala: ${error.message}`);
      else setEscalas((atual) => [...atual, nova as Escala]);
    }
    setSalvandoId(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao space-y-3">
        <p className="text-center text-lg font-semibold">
          {diaMes(dias[0])} a {diaMes(dias[6])}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, -7))}>
            ◀ Anterior
          </button>
          <button
            className="botao-secundario"
            onClick={() => setSegunda(inicioDaSemana(hoje))}
            disabled={segunda === inicioDaSemana(hoje)}
          >
            Hoje
          </button>
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, 7))}>
            Próxima ▶
          </button>
        </div>
      </div>

      {erro && <p className="rounded-xl bg-red-100 px-4 py-3 text-red-800">{erro}</p>}

      {turnos.length === 0 && !erro ? (
        <p className="text-neutral-600">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-white p-2 text-left">Turno</th>
                {dias.map((d) => (
                  <th
                    key={d}
                    className={`min-w-[96px] p-2 text-center ${
                      d === hoje ? "bg-yellow-100" : ""
                    }`}
                  >
                    {rotuloDia(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => (
                <tr key={turno.id} className="border-t border-neutral-200">
                  <th className="sticky left-0 z-[1] bg-white p-2 text-left align-top">
                    <span className="block font-semibold">{turno.nome}</span>
                    <span className="block text-xs font-normal text-neutral-500">
                      {horaCurta(turno.hora_inicio)}–{horaCurta(turno.hora_fim)}
                    </span>
                  </th>
                  {dias.map((d) => {
                    const lista = escaladosNa(d, turno.id);
                    return (
                      <td key={d} className="p-1 align-top">
                        <button
                          className={`flex min-h-[88px] w-full flex-col items-start gap-1 rounded-xl border p-2 text-left active:bg-neutral-100 ${
                            d === hoje ? "border-yellow-300 bg-yellow-50" : "border-neutral-200"
                          }`}
                          onClick={() => setCelulaAberta({ data: d, turno })}
                          disabled={carregando}
                        >
                          {lista.length === 0 ? (
                            <span className="text-neutral-400">+ Escolher</span>
                          ) : (
                            lista.map((e) => (
                              <span key={e.id} className="leading-tight">
                                {primeiroNome(porId.get(e.funcionario_id)?.nome)}
                              </span>
                            ))
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-neutral-500">
        Toque em um quadrado para escolher quem trabalha. No celular, arraste a grade para o lado
        para ver todos os dias.
      </p>

      {celulaAberta && (
        <JanelaEscolha
          celula={celulaAberta}
          funcionarios={funcionarios}
          escalados={new Set(escaladosNa(celulaAberta.data, celulaAberta.turno.id).map((e) => e.funcionario_id))}
          salvandoId={salvandoId}
          aoAlternar={alternar}
          aoFechar={() => setCelulaAberta(null)}
        />
      )}
    </div>
  );
}

function primeiroNome(nome?: string): string {
  if (!nome) return "?";
  const partes = nome.split(" ");
  return partes.length > 1 ? `${partes[0]} ${partes[1][0]}.` : nome;
}

function JanelaEscolha({
  celula,
  funcionarios,
  escalados,
  salvandoId,
  aoAlternar,
  aoFechar,
}: {
  celula: Celula;
  funcionarios: Funcionario[];
  escalados: Set<string>;
  salvandoId: string | null;
  aoAlternar: (f: Funcionario) => void;
  aoFechar: () => void;
}) {
  // Ativos aparecem sempre; desativados só se já estiverem nesta célula (para poder tirar).
  const visiveis = funcionarios.filter((f) => f.ativo || escalados.has(f.id));
  const porFuncao = new Map<string, Funcionario[]>();
  for (const f of visiveis) {
    porFuncao.set(f.funcao, [...(porFuncao.get(f.funcao) ?? []), f]);
  }
  const grupos = Array.from(porFuncao.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  const diaSemana = DIAS_SEMANA[paraData(celula.data).getDay()];

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={aoFechar}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-200 p-4">
          <p className="text-lg font-bold">
            {celula.turno.nome} · {diaSemana} {diaMes(celula.data)}
          </p>
          <p className="text-sm text-neutral-600">
            {escalados.size} {escalados.size === 1 ? "pessoa escalada" : "pessoas escaladas"}
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {grupos.map(([funcao, lista]) => (
            <section key={funcao}>
              <h3 className="mb-2 font-semibold text-neutral-600">{funcao}</h3>
              <ul className="space-y-2">
                {lista.map((f) => {
                  const marcado = escalados.has(f.id);
                  return (
                    <li key={f.id}>
                      <label
                        className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-3 text-base ${
                          marcado ? "border-green-500 bg-green-50" : "border-neutral-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-6 w-6 shrink-0"
                          checked={marcado}
                          disabled={salvandoId !== null}
                          onChange={() => aoAlternar(f)}
                        />
                        <span className="flex-1">
                          {f.nome}
                          {!f.ativo && <span className="text-neutral-500"> (desativado)</span>}
                        </span>
                        {salvandoId === f.id && (
                          <span className="text-sm text-neutral-500">Salvando...</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {grupos.length === 0 && (
            <p className="text-neutral-600">Nenhum funcionário ativo. Cadastre na tela Equipe.</p>
          )}
        </div>
        <div className="border-t border-neutral-200 p-4">
          <button className="botao w-full" onClick={aoFechar}>
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
