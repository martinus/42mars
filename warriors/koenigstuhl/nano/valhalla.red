;redcode-nano
;name Valhalla
;author John Metcalf
;strategy clear
;assert CORESIZE==80

ptr  spl   #10,    >52
loop mov   bmb,    }ptr
     mov   >ptr,   }ptr
     djn.f loop,   }ptr
bmb  dat   8,      35

     end
