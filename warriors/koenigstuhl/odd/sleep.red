;redcode-rwlimit
;name Sleep all day...
;author John Metcalf
;strategy deadline is looming so take
;strategy the easy option - paper!
;strategy poor core coverage - 75% :-(
;strategy redcoders frenzy r-12
;assert CORESIZE==8000

     pstep1 equ -388
     pstep2 equ 396
     silky  equ 300
     spl   1,        1       ; nothing in range to
     spl   1,        1       ; hit with decrement
pap1:spl   @pap1,    >pstep1  
     mov   }pap1,    >pap1
     mov   }pap1,    >pap1
bpos:mov.i #silky,   }bpos
     mov.i dbmb,     }bpos   
     mov   {pap1,    {pap2
     mov   {pap1,    {pap2
pap2:jmz.a pstep2,   *0
dbmb:
     end
