import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { todoService } from '../services/todo';
import type { Todo, TodoCreate } from '../services/todo';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

import { Pagination } from '../components/Pagination';

export const TodoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data: todosResponse, isLoading } = useQuery({
    queryKey: ['todos', offset],
    queryFn: () => todoService.getTodos(undefined, limit, offset)
  });

  const createMutation = useMutation({
    mutationFn: (newTodo: TodoCreate) => todoService.createTodo(newTodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewTodoTitle('');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: (todo: Todo) => todoService.updateTodo(todo.public_id, { completed: !todo.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => todoService.deleteTodo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    createMutation.mutate({ title: newTodoTitle.trim() });
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Todos</h1>
        <p className="mt-2 text-slate-400">Manage your tasks for this workspace.</p>
      </header>

      <form onSubmit={handleCreate} className="mb-8 flex gap-4">
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={createMutation.isPending}
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newTodoTitle.trim()}
          className="rounded-lg bg-blue-600 px-8 py-4 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Add Task
        </button>
      </form>

      {isLoading ? (
        <div className="text-center text-slate-400">Loading tasks...</div>
      ) : (
        <div className="space-y-3">
          {todosResponse?.items.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-8 text-center text-slate-400">
              No tasks yet. Add one above!
            </div>
          ) : (
            <>
            {todosResponse?.items.map((todo) => (
              <div 
                key={todo.public_id} 
                className={`group flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:border-slate-600 ${todo.completed ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleMutation.mutate(todo)}
                    className="text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-blue-500" />
                    ) : (
                      <Circle className="h-6 w-6" />
                    )}
                  </button>
                  <div>
                    <h3 className={`font-medium text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                      {todo.title}
                    </h3>
                  </div>
                </div>
                
                <button 
                  onClick={() => deleteMutation.mutate(todo.public_id)}
                  className="rounded p-2 text-slate-500 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            {todosResponse && (
              <Pagination 
                total={todosResponse.total} 
                limit={todosResponse.limit} 
                offset={todosResponse.offset} 
                onPageChange={setOffset} 
              />
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
