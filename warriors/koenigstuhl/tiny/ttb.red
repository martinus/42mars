;redcode-tiny
;name Tiny Tiny Bombers
;author John Metcalf
;strategy launch lots of tiny tiny bombers
;assert CORESIZE==800

        qx     equ 504
        qy     equ 701

        sne.x  qf+((qx-1)*qy+1)*(((qx-1)*qy)%800), qf+(qx-1)*qy
        seq.x  qf+(qx*qy+1)*((qx*qy)%800),         }qf
        jmp    @qlo+1,                             {qf
        sne.x  qf+((qx+1)*qy+1)*(((qx+1)*qy)%800), qf+(qx+1)*qy
        jmz.f  tspl,                               <qf

qf      mul.x  #qx,        #qy    ; decode
        jmz.f  @qlo+1,     >qf

qlo     mov    }519,       >qf    ; attack
        mov    }qlo,       {qf
        seq    {qf,        >qf
        djn.f  qlo,        >qf

        first  equ 88
        step   equ -351

tspl    spl    #352,       <boot
        mov.i  #1,         <boot
boot    mov    tdjn,       first
        sub    #-step,     boot
        mov    tspl,       @boot
        djn.f  @boot,      {tspl

tdjn    djn    -2,         #147

