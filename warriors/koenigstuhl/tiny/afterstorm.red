;redcode-tiny
;name after the storm
;author John Metcalf
;strategy oneshot
;assert CORESIZE==800

        f equ loop+31
        s equ 15
        i equ 4
        j equ 10
        d equ -69

bomb    dat   1,     j

        for   s-5
        dat   0,0
        rof

loop    sub   inc,   scan
        mov   bomb,  @scan
scan    sne   f+i,   @f
        djn.f loop,  <d

inc     mov.i -s,    #-s

clr     spl   #250,  j+3
        mov   *inc,  >scan
        mov   *inc,  >scan
        djn.f -2,    }clr

        end   loop+1

