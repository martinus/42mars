;redcode-nano
;name Clone
;author John Metcalf
;strategy clear
;assert CORESIZE==80

; developed from Resin but ended up looking almost
; identical to b69e6908-a5be0bba-ab4445f7.rc :-/

        mov    <22,      17
        spl    #20,      >-21
loop    mov.i  #24,      <1
        mov    <0,       {-36
        djn.f  loop,     <-6

        end
