;redcode-nano
;name Warm Coffee
;author Terry Newton
;strategy who knows, evolved using a mixture of random soup battles
;strategy and benchmarking, re-inserting the current top-scoring warrior
;strategy sequence: SPL MOV MOV DJN SPL (tried for different, wouldn't)
;strategy Top-20 Koenigstuhl (1/09) score = 155, NanoBM07 score = 148
;assert CORESIZE==80
spl.a  #-31,>18
mov.i  #-3,>-13
mov.i  *8,{-2
djn.i  $-1,$-3
spl.i  #27,{11
end
