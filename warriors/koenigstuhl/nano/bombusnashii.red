;redcode-nano
;name Bombus Nashii
;author S.Fernandes
;strategy scanner
;assert CORESIZE==80

        org     attack
step    equ     43

loop    add.ab  #step       ,    #45
attack  jmz.f   loop        ,    @loop
        mov.i   bomb        ,    >loop
        djn.f   attack      ,    <74

bomb    mov.i   #4          ,    -1
        end

