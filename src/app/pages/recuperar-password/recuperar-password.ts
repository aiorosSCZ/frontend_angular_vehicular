import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css'
})
export class RecuperarPassword {
  step: number = 1; // 1: Correo, 2: Token, 3: Nueva Password
  correo: string = '';
  token: string = '';
  nuevaPassword: string = '';
  
  loading: boolean = false;
  errorMsg: string = '';
  successMsg: string = '';

  constructor(private router: Router) {}

  async solicitarToken(event: Event) {
    event.preventDefault();
    if (!this.correo) {
      this.errorMsg = 'Por favor ingresa tu correo.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    
    try {
      const response = await fetch(`https://backend-fastapi-4g1h.onrender.com/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: this.correo })
      });
      this.loading = false;
      if (response.ok) {
        this.step = 2;
        this.successMsg = 'Código enviado. Revisa tu bandeja de entrada.';
      } else {
        const data = await response.json();
        this.errorMsg = data.detail || 'Correo no registrado.';
      }
    } catch (e) {
      this.loading = false;
      this.errorMsg = 'Error de conexión con el servidor.';
    }
  }

  async verificarToken(event: Event) {
    event.preventDefault();
    if (!this.token || this.token.length !== 6) {
      this.errorMsg = 'El código debe ser de 6 dígitos.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    
    try {
      const response = await fetch(`https://backend-fastapi-4g1h.onrender.com/api/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: this.correo, token: this.token })
      });
      this.loading = false;
      if (response.ok) {
        this.step = 3;
        this.successMsg = 'Código verificado. Ingresa tu nueva contraseña.';
      } else {
        this.errorMsg = 'Código inválido o expirado.';
      }
    } catch (e) {
      this.loading = false;
      this.errorMsg = 'Error al verificar el código.';
    }
  }

  async cambiarPassword(event: Event) {
    event.preventDefault();
    if (this.nuevaPassword.length < 6) {
      this.errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    
    try {
      const response = await fetch(`https://backend-fastapi-4g1h.onrender.com/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          correo: this.correo, 
          token: this.token, 
          nueva_password: this.nuevaPassword 
        })
      });
      this.loading = false;
      if (response.ok) {
        alert('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.');
        this.router.navigate(['/login']);
      } else {
        this.errorMsg = 'Error al actualizar la contraseña.';
      }
    } catch (e) {
      this.loading = false;
      this.errorMsg = 'Error de conexión.';
    }
  }
}
