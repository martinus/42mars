;redcode-nano
;name Resin
;author John Metcalf
;strategy clear
;assert CORESIZE==80

        mov    <53,    42
        spl    #30,    >-22
loop    mov    1,      <1
        mov    <0,     <36
        djn.f  loop,   <-11

        end