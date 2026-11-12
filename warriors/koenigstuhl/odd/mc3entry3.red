;redcode
;name tmp 100
;author Joonas
;assert 1

        ORG      START
	MOV.I  #     0, <     1     
	JMZ.B  #    -1, $    -4     
	DJN.A  *    -1, }    -1     
START	SEQ.I  $ -2669, $ -2666     
	ADD.AB #  2667, }     4     
	SNE.I  $  2662, $  2665     
	JMZ.A  $    -5, $     2     
	JMZ.F  $     0, <     1     
	MOV.I  #     0, @  2668     
	JMP.B  $    -8, }    -8     

END

;	***** SCORE: 100% WINS *****
