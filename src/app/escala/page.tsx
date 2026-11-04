"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA_CURTO,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  somarDias,
} from "@/lib/datas";

// Chave de uma célula da grade: "2026-11-20|id-do-turno"
const chaveCelula = (data: string, turnoId: string) => `${data}|${turnoId}`;

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [celulaAberta, setCelulaAberta] = useState<{ data: string; turno: Turno } | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const dias = useMemo(() => diasDaSemana(segunda), [segunda]);
  const hoje = hojeISO();

  // Turnos e funcionários: carregados uma vez.
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) {
        setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
        setCarregando(false);
        return;
      }
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro(`Não foi possível carregar os dados. Detalhe: ${(t.error ?? f.error)?.message}`);
        return;
      }
      setTurnos(t.data ?? []);
      setFuncionarios(f.data ?? []);
    }
    carregarBase();
  }, []);

  // Escalas da semana: recarregadas ao trocar de semana.
  const carregarEscalas = useCallback(async () => {
    if (!variaveisConfiguradas()) return;
    setCarregando(true);
    const { data, error } = await supabase()
      .from("escalas")
      .select("id, data, turno_id, funcionario_id")
      .gte("data", dias[0])
      .lte("data", dias[6]);
    if (error) setErro(`Não foi possível carregar a escala. Detalhe: ${error.message}`);
    else setEscalas(data ?? []);
    setCarregando(false);
  }, [dias]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarEscalas();
  }, [carregarEscalas]);

  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  // Quem está em cada célula.
  const porCelula = useMemo(() => {
    const mapa = new Map<string, Escala[]>();
    for (const e of escalas) {
      const chave = chaveCelula(e.data, e.turno_id);
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    }
    return mapa;
  }, [escalas]);

  async function alternar(funcionario: Funcionario) {
    if (!celulaAberta) return;
    const { data, turno } = celulaAberta;
    const existente = (porCelula.get(chaveCelula(data, turno.id)) ?? []).find(
      (e) => e.funcionario_id === funcionario.id,
    );
    setSalvandoId(funcionario.id);
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro(`Não foi possível remover. Detalhe: ${error.message}`);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro(`Não foi possível salvar. Detalhe: ${error.message}`);
      else setEscalas((atual) => [...atual, nova]);
    }
    setSalvandoId(null);
  }

  // No painel: ativos + quem já estiver escalado (mesmo desativado depois).
  const escaladosNaCelula = celulaAberta
    ? new Set(
        (porCelula.get(chaveCelula(celulaAberta.data, celulaAberta.turno.id)) ?? []).map(
          (e) => e.funcionario_id,
        ),
      )
    : new Set<string>();
  const opcoesPainel = funcionarios.filter((f) => f.ativo || escaladosNaCelula.has(f.id));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao space-y-3">
        <p className="text-center text-lg font-semibold">
          {diaMes(dias[0])} a {diaMes(dias[6])}/{dias[6].slice(0, 4)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, -7))}>
            ◀ Anterior
          </button>
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, 7))}>
            Seguinte ▶
          </button>
        </div>
        {segunda !== inicioDaSemana(hoje) && (
          <button className="botao w-full" onClick={() => setSegunda(inicioDaSemana(hoje))}>
            Voltar para esta semana
          </button>
        )}
      </div>

      {erro && (
        <p className="cartao border-red-300 text-red-700">
          {erro}{" "}
          <button className="underline" onClick={() => setErro(null)}>
            Fechar
          </button>
        </p>
      )}

      <p className="text-sm text-neutral-600">
        Toque num quadro para escolher quem trabalha. Arraste para o lado para ver todos os dias.
      </p>

      <div className={`overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm ${carregando ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] min-w-24 border-b border-neutral-200 bg-white p-2 text-left">
                Turno
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className={`min-w-28 border-b border-l border-neutral-200 p-2 text-center ${
                    d === hoje ? "bg-amber-50" : ""
                  }`}
                >
                  <span className="block text-base">{DIAS_SEMANA_CURTO[paraData(d).getDay()]}</span>
                  <span className="font-normal text-neutral-600">{diaMes(d)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <th className="sticky left-0 z-[1] border-b border-neutral-200 bg-white p-2 text-left align-top">
                  <span className="block text-base">{t.nome}</span>
                  <span className="font-normal text-neutral-600">
                    {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                  </span>
                </th>
                {dias.map((d) => {
                  const lista = porCelula.get(chaveCelula(d, t.id)) ?? [];
                  return (
                    <td
                      key={d}
                      className={`border-b border-l border-neutral-200 p-1 align-top ${
                        d === hoje ? "bg-amber-50" : ""
                      }`}
                    >
                      <button
                        className="flex min-h-24 w-full flex-col items-start gap-1 rounded-lg p-2 text-left active:bg-neutral-100"
                        onClick={() => setCelulaAberta({ data: d, turno: t })}
                      >
                        {lista.length === 0 ? (
                          <span className="text-neutral-400">+ Escalar</span>
                        ) : (
                          lista
                            .map((e) => ({ id: e.id, nome: porId.get(e.funcionario_id)?.nome ?? "?" }))
                            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                            .map(({ id, nome }) => (
                              <span key={id} className="leading-tight">
                                {nome.split(" ")[0]}
                              </span>
                            ))
                        )}
                        {lista.length > 0 && (
                          <span className="mt-auto text-xs text-neutral-500">
                            {lista.length} {lista.length === 1 ? "pessoa" : "pessoas"}
                          </span>
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

      {celulaAberta && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCelulaAberta(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold">
              {celulaAberta.turno.nome} ·{" "}
              {DIAS_SEMANA_CURTO[paraData(celulaAberta.data).getDay()]} {diaMes(celulaAberta.data)}
            </h2>
            <p className="mb-3 text-neutral-600">Marque quem trabalha. Salva na hora.</p>
            <ul className="space-y-2">
              {opcoesPainel.map((f) => {
                const marcado = escaladosNaCelula.has(f.id);
                return (
                  <li key={f.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        marcado ? "border-green-500 bg-green-50" : "border-neutral-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0"
                        checked={marcado}
                        disabled={salvandoId !== null}
                        onChange={() => alternar(f)}
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{f.nome}</span>
                        <span className="text-sm text-neutral-600">
                          {f.funcao}
                          {!f.ativo && " · desativado"}
                        </span>
                      </span>
                      {salvandoId === f.id && (
                        <span className="text-sm text-neutral-500">Salvando...</span>
                      )}
                    </label>
                  </li>
                );
              })}
              {opcoesPainel.length === 0 && (
                <li className="text-neutral-600">Nenhum funcionário ativo. Cadastre na tela Equipe.</li>
              )}
            </ul>
            <button className="botao mt-4 w-full" onClick={() => setCelulaAberta(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
