;redcode-94odd
;author Will 'Varfar'
;name Hope
;strategy IRCT19
;assert 1

        org     start

delay   djn.f   delay,  -10     ; till own fastimp hits it
start   spl     delay

fastimp mov.i   #1,     *1

        end
