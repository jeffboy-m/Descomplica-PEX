import { Routes } from '@angular/router';
import { ListaProdutos } from './components/lista-produtos/lista-produtos';
import { CadastroProduto } from './components/cadastro-produto/cadastro-produto';
import { EditarProduto } from './components/editar-produto/editar-produto';
import { LoginComponent } from './components/login/login';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'produtos', 
    component: ListaProdutos,
    canActivate: [authGuard] 
  },
  { 
    path: 'cadastrar', 
    component: CadastroProduto,
    canActivate: [authGuard]
  },
  { 
    path: 'editar/:id', 
    component: EditarProduto,
    canActivate: [authGuard]
  }
];
