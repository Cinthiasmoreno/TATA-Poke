"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = funcionário novo
  nome: string;
  funcao: string;
  telefone: string;
};

const FORMULARIO_VAZIO: Formulario = { id: null, nome: "", funcao: "", telefone: "" };

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(() => variaveisConfiguradas());
  const [erro, setErro] = useState<string | null>(() =>
    variaveisConfiguradas() ? null : "O banco de dados não está configurado. Veja a página Início.",
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Mudar "versao" faz a lista ser buscada de novo no banco.
  const [versao, setVersao] = useState(0);
  const carregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    async function buscar() {
      if (!variaveisConfiguradas()) return;
      const { data, error } = await supabase()
        .from("funcionarios")
        .select("id, nome, funcao, telefone, cpf, ativo")
        .order("nome");
      if (error) setErro(`Não foi possível carregar a equipe: ${error.message}`);
      else setFuncionarios(data as Funcionario[]);
      setCarregando(false);
    }
    buscar();
  }, [versao]);

  // Funções do banco + funções padrão, sem repetir.
  const funcoes = useMemo(() => {
    const todas = new Set([...FUNCOES_PADRAO, ...funcionarios.map((f) => f.funcao)]);
    return Array.from(todas).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  function mostrarAviso(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 2500);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    const funcao = formulario.funcao.trim();
    if (!nome || !funcao) {
      setErro("Preencha o nome e a função.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const dados = { nome, funcao, telefone: formulario.telefone.trim() || null };
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`);
      return;
    }
    setFormulario(null);
    mostrarAviso(formulario.id ? "Alterações salvas." : "Funcionário adicionado.");
    carregar();
  }

  async function mudarAtivo(f: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${f.nome}? Ele(a) deixa de aparecer na escala.`)) return;
    setErro(null);
    const { error } = await supabase().from("funcionarios").update({ ativo }).eq("id", f.id);
    if (error) {
      setErro(`Não foi possível alterar: ${error.message}`);
      return;
    }
    mostrarAviso(ativo ? `${f.nome} foi reativado(a).` : `${f.nome} foi desativado(a).`);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao" onClick={() => setFormulario({ ...FORMULARIO_VAZIO })}>
            + Adicionar
          </button>
        )}
      </div>

      {aviso && (
        <p className="rounded-xl bg-green-100 px-4 py-3 font-semibold text-green-800">{aviso}</p>
      )}
      {erro && <p className="rounded-xl bg-red-100 px-4 py-3 text-red-800">{erro}</p>}

      {formulario && (
        <form onSubmit={salvar} className="cartao space-y-3">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              autoFocus
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
              required
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
              placeholder="(11) 90000-0000"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
            />
          </label>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="botao flex-1" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="botao-secundario flex-1"
              onClick={() => setFormulario(null)}
              disabled={salvando}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-neutral-600">Carregando...</p>
      ) : (
        <>
          {ativos.length === 0 && (
            <p className="cartao text-neutral-600">Nenhum funcionário ativo cadastrado.</p>
          )}
          <ul className="space-y-3">
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
          </ul>

          {inativos.length > 0 && (
            <section className="space-y-3 pt-2">
              <h2 className="text-lg font-semibold text-neutral-600">Desativados</h2>
              <ul className="space-y-3 opacity-70">
                {inativos.map((f) => (
                  <CartaoFuncionario
                    key={f.id}
                    funcionario={f}
                    aoMudarAtivo={() => mudarAtivo(f, true)}
                  />
                ))}
              </ul>
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
  return (
    <li className="cartao">
      <p className="text-lg font-semibold">{funcionario.nome}</p>
      <p className="text-neutral-700">{funcionario.funcao}</p>
      {funcionario.telefone && (
        <a href={`tel:${funcionario.telefone.replace(/\D/g, "")}`} className="text-neutral-700 underline">
          {funcionario.telefone}
        </a>
      )}
      <div className="mt-3 flex gap-3">
        {aoEditar && (
          <button className="botao-secundario flex-1" onClick={aoEditar}>
            Editar
          </button>
        )}
        <button className="botao-secundario flex-1" onClick={aoMudarAtivo}>
          {funcionario.ativo ? "Desativar" : "Reativar"}
        </button>
      </div>
    </li>
  );
}
