;redcode-94x
;name 3 and 3
;author Lukasz Adamowski
;strategy IRCT10
;assert 1

bomb    dat.f   $3,     $2
step    spl     $0,     $268
loop    add.b   step,   shoot
shoot   mov.f   bomb,   $-2-264
        jmp     $loop,  {-5

        end     step
