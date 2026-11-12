;redcode-lp
;name Vr'ugugat
;author Christian Schmidt
;assert 1
;strategy lp replication, scan, dat-wipe
;strategy totally unoptimized

ConA EQU  7627
ConB EQU  2786
ConC EQU  2646
ConD EQU  13

from   mov     #ConD,      #ConD
loop   mov     <from,   {to
       jmn     loop,    from
to     spl     ConA,    ConB
       add.a   #ConC,   to
       spl     from,   0
scan   add.b   to,     #0
       jmz.f   scan,   @scan
       mov.i   2,      >scan
       jmp     -2,     0
       dat     >5334   , >2667

end

