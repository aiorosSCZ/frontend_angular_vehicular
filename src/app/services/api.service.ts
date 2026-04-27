import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = `https://backend-fastapi-4g1h.onrender.com/api`;

  constructor(private http: HttpClient) { }

  // --- Talleres ---

  registerTaller(tallerData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/talleres/`, tallerData);
  }

  loginTaller(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/talleres/login`, credentials);
  }

  // --- Clientes (Por si acaso se usara en web) ---

  registerCliente(clienteData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/clientes/`, clienteData);
  }
}
