"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = novo funcionário
  nome: string;
  funcao: string;
  telefone: string;
};

const FORMULARIO_VAZIO: Formulario = { id: null, nome: "", funcao: "", telefone: "" };

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase()
      .from("funcionarios")
      .select("id, nome, funcao, telefone, cpf, ativo")
      .order("nome");
    if (error) setErro(`Não foi possível carregar a equipe. Detalhe: ${error.message}`);
    else {
      setErro(null);
      setFuncionarios(data ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Funções do banco + funções padrão, sem repetir.
  const funcoes = useMemo(() => {
    const todas = new Set([...FUNCOES_PADRAO, ...funcionarios.map((f) => f.funcao)]);
    return [...todas].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  function mostrarAviso(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  }

  async function salvar() {
    if (!formulario) return;
    const nome = formulario.nome.trim();
    if (!nome || !formulario.funcao) {
      setErro("Preencha o nome e escolha a função.");
      return;
    }
    setSalvando(true);
    const dados = {
      nome,
      funcao: formulario.funcao,
      telefone: formulario.telefone.trim() || null,
    };
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar. Detalhe: ${error.message}`);
      return;
    }
    setErro(null);
    setFormulario(null);
    mostrarAviso(formulario.id ? "Alterações salvas." : "Funcionário adicionado.");
    carregar();
  }

  async function mudarAtivo(f: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${f.nome}? Ele(a) deixa de aparecer na escala.`)) return;
    const { error } = await supabase().from("funcionarios").update({ ativo }).eq("id", f.id);
    if (error) {
      setErro(`Não foi possível atualizar. Detalhe: ${error.message}`);
      return;
    }
    mostrarAviso(ativo ? `${f.nome} reativado(a).` : `${f.nome} desativado(a).`);
    carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao w-full sm:w-auto" onClick={() => setFormulario(FORMULARIO_VAZIO)}>
            + Adicionar funcionário
          </button>
        )}
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}
      {aviso && <p className="cartao border-green-300 text-green-700">{aviso}</p>}

      {formulario && (
        <section className="cartao space-y-4">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              placeholder="Ex.: Maria Silva"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
            >
              <option value="">Escolha a função</option>
              {funcoes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
              placeholder="(11) 90000-0000"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="botao flex-1" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              className="botao-secundario flex-1"
              onClick={() => {
                setFormulario(null);
                setErro(null);
              }}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      {carregando ? (
        <p className="text-neutral-600">Carregando equipe...</p>
      ) : (
        <>
          <section className="space-y-3">
            {ativos.length === 0 && (
              <p className="text-neutral-600">Nenhum funcionário ativo cadastrado.</p>
            )}
            {ativos.map((f) => (
              <CartaoFuncionario
                key={f.id}
                funcionario={f}
                aoEditar={() =>
                  setFormulario({
                    id: f.id,
                    nome: f.nome,
                    funcao: f.funcao,
                    telefone: f.telefone ?? "",
                  })
                }
                aoMudarAtivo={() => mudarAtivo(f, false)}
              />
            ))}
          </section>

          {inativos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-600">
                Desativados ({inativos.length})
              </h2>
              {inativos.map((f) => (
                <CartaoFuncionario
                  key={f.id}
                  funcionario={f}
                  aoMudarAtivo={() => mudarAtivo(f, true)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CartaoFuncionario({
  funcionario,
  aoEditar,
  aoMudarAtivo,
}: {
  funcionario: Funcionario;
  aoEditar?: () => void;
  aoMudarAtivo: () => void;
}) {
  const { nome, funcao, telefone, ativo } = funcionario;
  return (
    <div className={`cartao ${ativo ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{nome}</p>
          <p className="text-neutral-700">{funcao}</p>
          {telefone ? (
            <a href={`tel:${telefone.replace(/\D/g, "")}`} className="text-neutral-600 underline">
              {telefone}
            </a>
          ) : (
            <p className="text-neutral-500">Sem telefone</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {aoEditar && (
          <button className="botao-secundario flex-1" onClick={aoEditar}>
            Editar
          </button>
        )}
        <button className="botao-secundario flex-1" onClick={aoMudarAtivo}>
          {ativo ? "Desativar" : "Reativar"}
        </button>
      </div>
    </div>
  );
}
