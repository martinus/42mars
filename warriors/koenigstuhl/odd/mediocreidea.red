;redcode-94
;author Will 'Varfar'
;name MediocreIdeaBadlyImplemented
;strategy Vampish nastiness
;assert 1

        dist    equ     40
        n       equ     10
        
throw   mov     fang,   *fang 
        add.f   step,   fang
        jmz     throw,  pit     ; caught something?
        spl     throw
attack  mov     pit,    >pit
        jmn     attack, @pit
        mov     #0,     pit
step    dat     #n,     -n
fang    mov     #dist,  pit-dist

pit     end

