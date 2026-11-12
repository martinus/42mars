;redcode
;name Grendel
;author S.Fernandes
;strategy scanner

;assert 1
;       CORESIZE == 3800

        org     shades
step    equ     513
offset  equ     step
sep     equ     8
count   equ     180

target  mov.b   shades      ,    #speedup+1
wipe    mov     inc         ,    >target
loop    add     inc         ,    shades
shades  seq     }offset+sep ,    offset
        djn.f   target      ,    <target
speedup djn     loop        ,    #count
inc     spl     #step       ,    step
clear   mov     cleanup     ,    >clear-3
        djn.f   clear       ,    >clear-3
cleanup dat     1           ,    7
        end

