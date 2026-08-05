import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonItem, IonLabel, IonInput, 
  IonSelect, IonSelectOption, IonButton, IonSpinner, IonList, IonIcon 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, arrowBackOutline } from 'ionicons/icons'; // 🌟 Agregado arrowBack
import { DatabaseService } from '../../services/database';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; 

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonItem, 
    IonLabel, IonInput, IonSelect, IonSelectOption, 
    IonButton, IonSpinner, IonList, IonIcon
  ]
})
export class LoginPage implements OnInit {
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private firestore = inject(Firestore); 

  modoRegistro = false;
  cargando = false;
  
  correoGoogle: string = ''; 
  correoInstitucional: string = ''; 
  
  nombreCompleto: string = '';
  sede: string = '';       
  cedula: string = '';
  ciclo: string = '';
  beca: string = '';
  celular: string = '';

  carreraSeleccionada: string = '';
  busquedaCarrera: string = '';
  listaCarrerasMaster: string[] = [];
  carrerasFiltradas: string[] = [];

  constructor() {
    addIcons({ logoGoogle, arrowBackOutline }); 
  }

  async ngOnInit() {
    const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
    this.listaCarrerasMaster = catalogos.carreras || [];
  }

  ionViewWillEnter() {
    this.modoRegistro = false;
    this.cargando = false;
    this.correoGoogle = '';
    this.correoInstitucional = '';
    this.nombreCompleto = '';
    this.sede = '';
    this.cedula = '';
    this.carreraSeleccionada = '';
    this.busquedaCarrera = '';
    this.ciclo = '';
    this.beca = '';
    this.celular = '';
    this.carrerasFiltradas = [];
  }

  validarCedula(cedula: string): boolean {
    if (!cedula || cedula.length !== 10) return false;
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;
    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito > 5) return false; 
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let digito = parseInt(cedula.charAt(i), 10);
      if (i % 2 === 0) { digito = digito * 2; if (digito > 9) digito -= 9; }
      suma += digito;
    }
    const decenaSuperior = Math.ceil(suma / 10) * 10;
    let digitoVerificador = decenaSuperior - suma;
    if (digitoVerificador === 10) digitoVerificador = 0;
    return digitoVerificador === parseInt(cedula.charAt(9), 10);
  }

  validarCelular(celular: string): boolean {
    return celular.length === 10 && celular.startsWith('09');
  }

  filtrarCarreras() {
    const txt = this.busquedaCarrera.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { this.carrerasFiltradas = []; return; }
    this.carrerasFiltradas = this.listaCarrerasMaster.filter(c => 
      c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(txt)
    );
  }

  seleccionarCarrera(carrera: string) {
    this.carreraSeleccionada = carrera;
    this.busquedaCarrera = carrera; 
    this.carrerasFiltradas = [];    
  }

  async ingresarConGoogle() {
    this.cargando = true;

    try {
      const proveedor = new GoogleAuthProvider();
      proveedor.setCustomParameters({ prompt: 'select_account' });

      const resultadoAuth = await signInWithPopup(this.auth, proveedor);
      const usuarioGoogle = resultadoAuth.user;

      if (!usuarioGoogle.email) {
        alert("Error al leer la cuenta de Google.");
        this.cargando = false; return;
      }

      this.correoGoogle = usuarioGoogle.email.toLowerCase().trim();
      
      const respuestaBdd = await this.dbService.verificarUsuarioExistente(this.correoGoogle);

      if (respuestaBdd.existe) {
       this.iniciarSesionLocal(respuestaBdd.datos, respuestaBdd.rol || 'ESTUDIANTE');
      } else {
        this.nombreCompleto = ''; 
        this.modoRegistro = true;
        this.cargando = false;
      }

    } catch (error: any) {
      console.error("Error Auth:", error);
      this.cargando = false;
    }
  }

async procesarRegistroCompleto() {
    if (!this.correoInstitucional || !this.nombreCompleto || !this.cedula || !this.carreraSeleccionada || !this.ciclo || !this.beca || !this.celular || !this.sede) {
      alert("Por favor llena todos los campos obligatorios.");
      return;
    }

    const correoLimpio = this.correoInstitucional.toLowerCase().trim();

    if (!correoLimpio.endsWith('@est.ups.edu.ec') && !correoLimpio.endsWith('@ups.edu.ec')) {
      alert("❌ El correo ingresado no pertenece a la UPS.");
      return;
    }

    if (!this.validarCedula(this.cedula)) {
      alert("❌ La cédula ingresada no es válida."); return;
    }
    if (!this.validarCelular(this.celular)) {
      alert("📱 El número de celular debe empezar con 09 y tener 10 dígitos."); return;
    }

    this.cargando = true;

    try {
      const estRef = doc(this.firestore, 'Estudiantes', correoLimpio);
      const estSnap = await getDoc(estRef);
      if (estSnap.exists()) {
        alert(`❌ El correo ${correoLimpio} ya está vinculado a otra cuenta de Google.`);
        this.cargando = false; return;
      }

      const tutRef = doc(this.firestore, 'Tutores', correoLimpio);
      const tutSnap = await getDoc(tutRef);
      if (tutSnap.exists()) {
        const datosTutor = tutSnap.data();
        if (datosTutor['correo_google'] && datosTutor['correo_google'] !== this.correoGoogle) {
          alert(`❌ Este correo ya fue vinculado a la cuenta: ${datosTutor['correo_google']}.`);
          this.cargando = false; return;
        }
        await updateDoc(tutRef, { correo_google: this.correoGoogle });
        const datosActualizados = tutSnap.data();
        datosActualizados['correo_google'] = this.correoGoogle;
        this.iniciarSesionLocal(datosActualizados, datosActualizados['rol'] || 'TUTOR');
        return;
      }

      const adminRef = doc(this.firestore, 'Administradores', correoLimpio);
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        const datosAdmin = adminSnap.data();
        if (datosAdmin['correo_google'] && datosAdmin['correo_google'] !== this.correoGoogle) {
          alert(`❌ Este correo ya fue vinculado a la cuenta: ${datosAdmin['correo_google']}.`);
          this.cargando = false; return;
        }
        await updateDoc(adminRef, { correo_google: this.correoGoogle });
        const datosActualizados = adminSnap.data();
        datosActualizados['correo_google'] = this.correoGoogle;
        this.iniciarSesionLocal(datosActualizados, datosActualizados['rol'] || 'ADMIN');
        return;
      }

    } catch(e) { 
      console.error("Error al verificar unicidad:", e); 
      alert("Hubo un problema verificando tu correo. Inténtalo de nuevo.");
      this.cargando = false; return;
    }

    const nuevoEstudiante = {
      correo_google: this.correoGoogle,     
      correo: correoLimpio,                 
      nombre_completo: this.nombreCompleto.toUpperCase(),
      cedula: this.cedula,
      sede: this.sede,               
      carrera: this.carreraSeleccionada, 
      ciclo: this.ciclo,
      beca: this.beca,
      celular: this.celular,
      estado: 'ACTIVO',
      rol: 'ESTUDIANTE',
      fecha_registro: new Date().toISOString()
    };

    await this.dbService.registrarNuevoEstudiante(nuevoEstudiante);
    this.iniciarSesionLocal(nuevoEstudiante, 'ESTUDIANTE');
  }

 iniciarSesionLocal(datos: any, rol: string) {
    localStorage.setItem('correo', datos.correo); 
    localStorage.setItem('nombre', datos.nombre_completo || datos.nombre);
    localStorage.setItem('rol', rol);
    localStorage.setItem('sede', datos.sede || 'CUENCA'); 
    localStorage.setItem('carrera', datos.carrera || ''); 
    localStorage.setItem('ciclo', datos.ciclo);
    localStorage.setItem('cedula', datos.cedula);
    localStorage.setItem('celular', datos.celular);
    this.cargando = false;
    this.router.navigate(['/tabs/horarios']);
  }
}