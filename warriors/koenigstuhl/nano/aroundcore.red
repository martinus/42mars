;redcode-nano
;name around the core in 80 cycles
;author John Metcalf
;strategy clear
;assert CORESIZE==80

ptr  spl   #10,    >40
loop mov   bmb,    }ptr
     mov   >ptr,   }ptr
     djn.f loop,   }ptr
bmb  dat   5,      20
     end

