import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin {
  correo: string = '';
  password: string = '';
  loading: boolean = false;
  errorMsg: string = '';

  constructor(private router: Router) {}

  volverAlInicio() {
    this.router.navigate(['/']);
  }

  async onLogin(event: Event) {
    event.preventDefault();
    if (!this.correo || !this.password) {
      this.errorMsg = 'Por favor ingresa las credenciales.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    try {
      const response = await fetch(`https://backend-fastapi-4g1h.onrender.com/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: this.correo, password: this.password })
      });

      this.loading = false;
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_name', data.user_name);
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.errorMsg = 'Credenciales maestras incorrectas.';
      }
    } catch (e) {
      this.loading = false;
      this.errorMsg = 'Error al conectar con el servidor maestro.';
    }
  }
}
