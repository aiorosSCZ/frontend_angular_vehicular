import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login-taller',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-taller.html',
  styleUrl: './login-taller.css',
})
export class LoginTaller {
  correo: string = '';
  password: string = '';
  loading: boolean = false;
  errorMsg: string = '';

  constructor(private apiService: ApiService, private router: Router) {}

  onLogin(event: Event) {
    event.preventDefault();
    if (!this.correo || !this.password) {
      this.errorMsg = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    this.apiService.loginTaller({ correo: this.correo, password: this.password }).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.role === 'admin') {
          window.location.href = `https://backend-fastapi-4g1h.onrender.com/api/admin/panel`;
        } else {
          localStorage.setItem('token_taller', response.access_token);
          localStorage.setItem('user_id', response.user_id);
          localStorage.setItem('user_name', response.user_name);
          localStorage.setItem('user_nit', response.nit || '');
          localStorage.setItem('user_direccion', response.direccion || '');
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Credenciales incorrectas o error en el servidor.';
        console.error(err);
      }
    });
  }
}
