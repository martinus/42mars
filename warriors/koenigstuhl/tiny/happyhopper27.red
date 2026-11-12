;redcode
;name Happy Hopper Number 27
;author Terry Newton
;strategy evolved as 15_09.red by RedMixer 1.0d4b-800
;strategy (3/7/09) tweaked for slightly better score
;assert CORESIZE==800
mul.x  @  714 , }    0
spl.i  #  223 , <    1
spl.x  >  159 , >  718
mov.i  >   -3 , }   -1
mov.i  >  452 , {  766
mov.i  >  584 , {   -1
mov.i  >  586 , {  415
jmp.i  $   -4 , }  107
; end of the active replicating part, the rest
; is evolved "junk" but still makes a difference
; in operation and score. Noticed by commenting
; some lines the score could be increased so made
; a program that commented every combination of
; the extra lines then picked the "best" one :-)
mul.x  }  384 , #  713
sub.f  $   -9 , {   -6
mod.ba }  784 , <  442
;spl.ab {   -7 , }  426
;sne.ba #    7 , @  -10
jmz.a  >  195 , <  587
;spl.b  @   98 , #  270
;jmz.x  $  178 , >  128
end 1 ;evolved as end 0

