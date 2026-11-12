;redcode-94x
;name clearer
;author Will 'Varfar'
;strategy like a dclear?
;assert 1

        org     throw

gate    dat     0,      MINDISTANCE ; start somewhere here

        for     4
        dat     1,      1
        rof
        
throw   spl     #0,     >(gate-1)
        mov     bmb,    >gate
        mov     bmb,    >gate
        jmp     -1,     >(gate-1)
bmb     dat     #0,     2-gate

        end
