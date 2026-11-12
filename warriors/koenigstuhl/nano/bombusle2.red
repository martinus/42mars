;redcode-nano
;name Bombus Lepidus
;author S.Fernandes
;strategy scanner
;assert CORESIZE==80

        org     attack
step    equ     5

loop    add.ab  #step       ,    #12
attack  jmz.f   loop        ,    @loop
        mov.i   bomb        ,    >loop
        djn.f   attack      ,    <loop-2

bomb    mov.i   #1          ,    -1
        end
