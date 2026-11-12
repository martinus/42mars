;redcode-nano
;name Creamed Corn
;author Terry Newton
;strategy Evolved by MEVO, gen 2706
;strategy NanoBM07=153.9 Nanob2=156
;generation 2706
;species 8922
;origin 58_12
;assert CORESIZE==80
mov    >22,$10
spl.a  #-6,>-38
mov.i  <-1,{-1
mov.i  {-2,<-2
djn.x  $-2,<-34
end
;benchscore 153.94 (nanobm07 142 rounds)
