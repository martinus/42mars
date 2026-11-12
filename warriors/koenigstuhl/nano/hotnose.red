;redcode-nano
;name hot nose
;author gnik
;strategy guess!
;assert CORESIZE == 80

step    equ 5
first   equ 12

bmb:mov.i   #0,     <0
loo:add.ab  #step,  #first
scn:jmz.f   loo,    @loo
atk:mov.i   *bmb,   >loo
    djn.f   atk,    {atk
    end     scn

