;redcode-nano
;name a slice of moonbeam pie
;author John Metcalf
;strategy clear
;assert CORESIZE==80

    wipe  equ       gate-4

    mov   <40,      -24

gate:spl   #10,      <wipe
loop:mov   }dpos,    }gate
dpos:mov   <21,      <wipe
    djn.f loop,     <-35

    end
