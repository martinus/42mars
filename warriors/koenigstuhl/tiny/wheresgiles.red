;redcode-tiny
;name Where's Giles?
;author John Metcalf
;strategy TinyQ^4 -> Paper
;assert CORESIZE==800

     qx equ 504
     qy equ 701

     sne.x qf+((qx-1)*qy+1)*(((qx-1)*qy)%800), qf+(qx-1)*qy
     seq.x qf+(qx*qy+1)*((qx*qy)%800),         }qf
     jmp   @qlo+1,                             {qf
     sne.x qf+((qx+1)*qy+1)*(((qx+1)*qy)%800), qf+(qx+1)*qy
     jmz.f pgo,                                <qf

qf:  mul.x #qx,      #qy    ; decode
     jmz.f @qlo+1,   >qf

qlo: mov   }519,     >qf    ; attack
     mov   }qlo,     {qf
     seq   {qf,      >qf
     djn.f qlo,      >qf

pgo: spl   *1,       }184
     spl   1,        }254
     spl   1,        {355

pap1:spl   @0,       {267+10
     mov   }pap1,    >pap1
pap2:spl   @0,       }205
     mov   }pap2,    >pap2
     mov.i #255,     }267
     mov.i #267+5,   }1
end

