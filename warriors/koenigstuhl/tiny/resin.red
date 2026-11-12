;redcode-tiny
;name Resin
;author John Metcalf
;strategy something with imps
;assert CORESIZE==800

        org    warr

        iboot  equ (imp+173)
        gate   equ (cl-2)

cl      spl    #400,   <gate
        spl    #400,   <gate
clear   mov    1,      <1
        mov    <0,     <356
        djn.f  clear,  <gate

        for    3
        dat    0,0
        rof

        istep  equ 267         ; (CORESIZE+1)/3

        fi     equ (imp+24)
        st     equ 24

warr    spl    cl,             {fi+st*1
        mov    imp,            iboot
        spl    i4,             {fi+st*2
        spl    i2,             {fi+st*3
i6      spl    i1,             {fi+st*4
i3      jmp    iboot+0*istep,  }0
i4      spl    i6,             {fi+st*5
        spl    i5,             {fi+st*6
i1      jmp    iboot+1*istep,  }0
i2      spl    i3,             {fi+st*7
i5      jmp    iboot+2*istep,  }0

imp     mov.i  #0,             istep

        end

