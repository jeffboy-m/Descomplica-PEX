import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Verifica se existe um 'token' salvo no localStorage
  const isLogado = localStorage.getItem('usuario_logado');

  if (isLogado) {
    return true; // Deixa passar
  } else {
    // Se não estiver logado, manda de volta pro login
    router.navigate(['/login']);
    return false;
  }
};
