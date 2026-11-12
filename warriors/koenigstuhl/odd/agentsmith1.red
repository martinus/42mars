;redcode
;name Agent Smith
;author FatalC
;assert 1

        org     shades
target  mov     #2000      ,    #4000
        mov.ba  shades     ,    target
auto    add     slow       ,    shades
shades  sne     210        ,    202
        jmp     target
        mov     slow       ,    > target
        mov     slow       ,    }target
        djn     auto       ,    #400
slow    spl     #16        ,    16
clear   mov     cleanup    ,    > clear-20
        djn.f   clear      ,    > clear-21
cleanup dat      <2667      ,    26
        end
