;redcode-94odd
;author Will 'Varfar'
;name Hopeless
;strategy IRCT19
;assert 1

start   spl     fastimp

delay   djn.f   delay,  -10     ; till own fastimp hits it?

        mov.i   #3,     {-1
slowimp mov.i   #3,     {-1

        for     MAXLENGTH-CURLINE-1
        dat     0,      0
        rof

fastimp mov.i   #1,     *1

        end
