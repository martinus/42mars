;redcode-nano
;name Acarus Calvanicus
;author S.Fernandes
;strategy oneshot
;assert CORESIZE==80

        org     loop+1
step    equ     5

bomb    mov.i   #1          ,    -1
loop    add.ba  #9          ,    #step
        jmz.f   loop        ,    *loop
attack  mov.i   bomb        ,    }loop
        djn.f   attack      ,    {attack
        end

